import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { CELL_SIZE } from '../constants/sketch'
import type { CellEditState, SketchArray, SketchElement, SketchNode } from '../types/sketch'

export type ClipboardArrayCategory =
  | 'array'
  | 'set'
  | 'map'
  | 'map-keys'
  | 'map-values'
  | 'map-rows'
  | 'matrix'
  | 'matrix-row'
  | 'matrix-column'

export type SketchClipboard =
  | { kind: 'value'; sourceKind: 'variable' | 'node' | 'cell'; value: string; label?: string }
  | {
      kind: 'array'
      category: ClipboardArrayCategory
      values: string[]
      columns?: number
      label?: string
      requiresEmptyDestination?: boolean
    }
  | { kind: 'nodes'; nodes: SketchNode[] }

type NormalizedArrayValues = {
  values: string[]
  elementIds: number[]
  removedCellIds: Set<number>
}

const normalizeCollectionValues = (
  array: SketchArray,
  values: string[],
  elementIds: number[],
  preferredCellIds: Set<number>,
): NormalizedArrayValues => {
  const keepIndexes = new Set<number>()
  const keyIndexes = new Map<string, number[]>()
  const step = array.layout === 'map' ? 2 : 1
  for (let index = 0; index < values.length; index += step) {
    const key = values[index]
    if (!key) {
      keepIndexes.add(index)
      if (step === 2 && index + 1 < values.length) keepIndexes.add(index + 1)
      continue
    }
    const indexes = keyIndexes.get(key) ?? []
    indexes.push(index)
    keyIndexes.set(key, indexes)
  }
  keyIndexes.forEach((indexes) => {
    const preferred = indexes.filter((index) => preferredCellIds.has(elementIds[index]))
    const keepIndex = (preferred.length > 0 ? preferred : indexes).at(-1)
    if (keepIndex === undefined) return
    keepIndexes.add(keepIndex)
    if (step === 2 && keepIndex + 1 < values.length) keepIndexes.add(keepIndex + 1)
  })
  const removedCellIds = new Set<number>()
  elementIds.forEach((cellId, index) => {
    if (!keepIndexes.has(index)) removedCellIds.add(cellId)
  })
  return {
    values: values.filter((_, index) => keepIndexes.has(index)),
    elementIds: elementIds.filter((_, index) => keepIndexes.has(index)),
    removedCellIds,
  }
}

type UseSketchClipboardOptions = {
  elements: SketchElement[]
  setElements: Dispatch<SetStateAction<SketchElement[]>>
  nextId: number
  setNextId: Dispatch<SetStateAction<number>>
  selectedIds: Set<number>
  setSelectedId: Dispatch<SetStateAction<number>>
  setSelectedIds: Dispatch<SetStateAction<Set<number>>>
  selectedCellIds: Set<number>
  setSelectedCellIds: Dispatch<SetStateAction<Set<number>>>
  selectedCell: number | null
  setSelectedCell: Dispatch<SetStateAction<number | null>>
  cellEditRef: MutableRefObject<CellEditState | null>
  elementEditRef: MutableRefObject<{ elementId: number; hasTyped: boolean } | null>
  clipboardRef: MutableRefObject<SketchClipboard | null>
}

export const useSketchClipboard = ({
  elements,
  setElements,
  nextId,
  setNextId,
  selectedIds,
  setSelectedId,
  setSelectedIds,
  selectedCellIds,
  setSelectedCellIds,
  selectedCell,
  setSelectedCell,
  cellEditRef,
  elementEditRef,
  clipboardRef,
}: UseSketchClipboardOptions) => {
  const copySelection = useCallback(() => {
    if (selectedCellIds.size > 0) {
      if (selectedIds.size !== 1) return
      const array = elements.find(
        (element): element is SketchArray =>
          element.kind === 'array' && element.id === selectedIds.values().next().value,
      )
      if (!array) return
      const indexes = [...selectedCellIds]
        .map((cellId) => array.element_ids.indexOf(cellId))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)
      if (indexes.length !== selectedCellIds.size) return
      if (indexes.length === 1) {
        clipboardRef.current = {
          kind: 'value',
          sourceKind: 'cell',
          value: array.values[indexes[0]],
        }
        return
      }

      let category: ClipboardArrayCategory | null = null
      let columns: number | undefined
      const contiguous = indexes.every(
        (index, position) => position === 0 || index === indexes[position - 1] + 1,
      )
      if (indexes.length === array.values.length) {
        category =
          array.layout === 'map'
            ? 'map'
            : array.layout === 'matrix'
              ? 'matrix'
              : array.layout === 'vertical' && array.label === 'set'
                ? 'set'
                : 'array'
        if (category === 'matrix') columns = Math.max(1, array.columns ?? 1)
      } else if (array.layout === 'map') {
        const selected = new Set(indexes)
        const allKeys = indexes.every((index) => index % 2 === 0)
        const allValues = indexes.every((index) => index % 2 === 1)
        const completePairs = indexes.every((index) =>
          selected.has(index % 2 === 0 ? index + 1 : index - 1),
        )
        const contiguousRows = indexes.every(
          (index, position) =>
            position === 0 || Math.floor(index / 2) <= Math.floor(indexes[position - 1] / 2) + 1,
        )
        if (contiguousRows && allKeys) category = 'map-keys'
        else if (contiguousRows && allValues) category = 'map-values'
        else if (completePairs && contiguousRows) category = 'map-rows'
      } else if (array.layout === 'matrix') {
        const matrixColumns = Math.max(1, array.columns ?? 1)
        const rowIndexes = [...new Set(indexes.map((index) => Math.floor(index / matrixColumns)))]
        const columnIndexes = [...new Set(indexes.map((index) => index % matrixColumns))]
        const isOneFullRow =
          rowIndexes.length === 1 &&
          indexes.length ===
            Math.min(matrixColumns, array.values.length - rowIndexes[0] * matrixColumns)
        const isOneFullColumn =
          columnIndexes.length === 1 &&
          rowIndexes.length === Math.ceil(array.values.length / matrixColumns) &&
          indexes.length === rowIndexes.length
        const isRectangle =
          indexes.length === rowIndexes.length * columnIndexes.length &&
          rowIndexes.every((row) =>
            columnIndexes.every(
              (column) =>
                row * matrixColumns + column < array.values.length &&
                selectedCellIds.has(array.element_ids[row * matrixColumns + column]),
            ),
          )
        if (isOneFullRow) {
          category = 'matrix-row'
          columns = indexes.length
        } else if (isOneFullColumn) {
          category = 'matrix-column'
          columns = 1
        } else if (isRectangle) {
          category = 'matrix'
          columns = columnIndexes.length
        }
      } else if (contiguous) {
        category = array.layout === 'vertical' && array.label === 'set' ? 'set' : 'array'
      }
      if (!category) return
      clipboardRef.current = {
        kind: 'array',
        category,
        values: indexes.map((index) => array.values[index]),
        columns,
        label: array.label,
        requiresEmptyDestination: category === 'matrix' || category === 'map-rows',
      }
      return
    }

    if (selectedIds.size === 0) return
    const selectedElements = [...selectedIds]
      .map((id) => elements.find((element) => element.id === id))
      .filter((element): element is Exclude<SketchElement, { kind: 'iterator' }> =>
        Boolean(element),
      )
    if (selectedElements.length !== selectedIds.size) return
    if (
      selectedElements.length > 1 &&
      selectedElements.every((element) => element.kind === 'node')
    ) {
      clipboardRef.current = {
        kind: 'nodes',
        nodes: selectedElements.filter((element): element is SketchNode => element.kind === 'node'),
      }
      return
    }
    if (selectedElements.length !== 1) return
    const element = selectedElements[0]
    if (element.kind === 'array') {
      if (element.layout === 'matrix') {
        clipboardRef.current = {
          kind: 'array',
          category: 'matrix',
          values: [...element.values],
          columns: Math.max(1, element.columns ?? 1),
          label: element.label,
          requiresEmptyDestination: true,
        }
      } else if (element.layout === 'map') {
        clipboardRef.current = {
          kind: 'array',
          category: 'map',
          values: [...element.values],
          label: element.label,
          requiresEmptyDestination: true,
        }
      } else {
        clipboardRef.current = {
          kind: 'array',
          category: element.layout === 'vertical' && element.label === 'set' ? 'set' : 'array',
          values: [...element.values],
          label: element.label,
        }
      }
    } else {
      clipboardRef.current = {
        kind: 'value',
        sourceKind: element.kind,
        value: element.value,
        label: element.kind === 'variable' ? element.label : undefined,
      }
    }
  }, [clipboardRef, elements, selectedCellIds, selectedIds])

  const pasteClipboard = useCallback(() => {
    const clipboard = clipboardRef.current
    if (!clipboard) return
    if (selectedIds.size === 0 && selectedCellIds.size === 0) {
      if (clipboard.kind === 'nodes') {
        const idMap = new Map(clipboard.nodes.map((node, index) => [node.id, nextId + index]))
        const offset = CELL_SIZE * (1 + (nextId % 4))
        const pastedNodes = clipboard.nodes.map((node, index) => ({
          ...node,
          id: nextId + index,
          pointer_ids: node.pointer_ids
            .map((pointerId) => idMap.get(pointerId))
            .filter((pointerId): pointerId is number => pointerId !== undefined),
          position: { x: node.position.x + offset, y: node.position.y + offset },
        }))
        setElements((current) => [...current, ...pastedNodes])
        setNextId((current) => current + pastedNodes.length)
        const pastedIds = new Set(pastedNodes.map((node) => node.id))
        setSelectedIds(pastedIds)
        setSelectedId(pastedNodes[0]?.id ?? 0)
        return
      }
      if (clipboard.kind === 'value') {
        const id = nextId
        const position = { x: 130 + (id % 3) * 70, y: 100 + (id % 3) * 60 }
        const newElement: SketchElement =
          clipboard.sourceKind === 'node'
            ? {
                id,
                kind: 'node',
                value: clipboard.value,
                pointer_ids: [],
                pointer_limit: '+',
                position,
              }
            : {
                id,
                kind: 'variable',
                label: clipboard.label ?? 'variable',
                value: clipboard.value,
                position,
              }
        setElements((current) => [...current, newElement])
        setNextId((current) => current + 1)
        setSelectedIds(new Set([id]))
        setSelectedId(id)
        return
      }

      const id = nextId
      const values = [...clipboard.values]
      let layout: SketchArray['layout'] = 'horizontal'
      let label = clipboard.label ?? 'array'
      let columns: number | undefined
      if (
        clipboard.category === 'set' ||
        clipboard.category === 'map-keys' ||
        clipboard.category === 'map-values' ||
        clipboard.category === 'map-rows'
      ) {
        layout = 'vertical'
        label = 'set'
      } else if (clipboard.category === 'map') {
        layout = 'map'
        label = clipboard.label ?? 'map'
        if (values.length % 2 !== 0) values.push('')
      } else if (clipboard.category === 'matrix') {
        layout = 'matrix'
        columns = Math.max(1, clipboard.columns ?? 1)
        label = clipboard.label ?? 'matrix'
      } else if (clipboard.category === 'matrix-row' || clipboard.category === 'matrix-column') {
        label = 'array'
      }
      if (values.length === 0) values.push('')
      const elementIds = values.map((_, index) => id + index + 1)
      const newArray: SketchArray = {
        id,
        kind: 'array',
        label,
        element_ids: elementIds,
        values,
        position: { x: 130 + (id % 3) * 70, y: 100 + (id % 3) * 60 },
        layout,
        columns,
      }
      if (layout === 'map' || (layout === 'vertical' && label === 'set')) {
        const normalized = normalizeCollectionValues(
          newArray,
          newArray.values,
          newArray.element_ids,
          new Set(newArray.element_ids),
        )
        newArray.values = normalized.values
        newArray.element_ids = normalized.elementIds
      }
      setElements((current) => [...current, newArray])
      setNextId((current) => current + values.length + 1)
      setSelectedIds(new Set([id]))
      setSelectedId(id)
      return
    }

    if (clipboard.kind === 'array' && clipboard.requiresEmptyDestination) return
    if (clipboard.kind === 'nodes' || selectedIds.size !== 1) return
    const target = elements.find((element) => element.id === selectedIds.values().next().value)
    if (!target) return
    if (clipboard.kind === 'array' && target.kind === 'array' && target.layout === 'map') return
    if (clipboard.kind === 'value') {
      if (target.kind === 'variable' || target.kind === 'node') {
        setElements((current) =>
          current.map((element) =>
            element.id === target.id && (element.kind === 'variable' || element.kind === 'node')
              ? { ...element, value: clipboard.value }
              : element,
          ),
        )
        if (target.kind === 'node')
          elementEditRef.current = { elementId: target.id, hasTyped: true }
        return
      }
      if (target.kind !== 'array') return
      const cellId =
        selectedCellIds.size === 1
          ? selectedCellIds.values().next().value
          : cellEditRef.current?.arrayId === target.id
            ? target.element_ids[cellEditRef.current.index]
            : undefined
      const index = cellId === undefined ? -1 : target.element_ids.indexOf(cellId)
      if (index < 0 || selectedCellIds.size > 1) return
      const nextValues = [...target.values]
      nextValues[index] = clipboard.value
      const preferredIds = new Set([target.element_ids[index]])
      const normalized =
        (target.layout === 'vertical' && target.label === 'set') || target.layout === 'map'
          ? normalizeCollectionValues(target, nextValues, target.element_ids, preferredIds)
          : {
              values: nextValues,
              elementIds: target.element_ids,
              removedCellIds: new Set<number>(),
            }
      const finalIndex = normalized.elementIds.indexOf(target.element_ids[index])
      const removedBefore = target.element_ids
        .slice(0, index)
        .filter((id) => normalized.removedCellIds.has(id)).length
      const positionShift =
        target.layout === 'map'
          ? (removedBefore / 2) * CELL_SIZE
          : target.layout === 'vertical'
            ? removedBefore * CELL_SIZE
            : 0
      setElements((current) =>
        current
          .filter(
            (element) =>
              !(element.kind === 'iterator' && normalized.removedCellIds.has(element.hostId)),
          )
          .map((element) =>
            element.kind === 'array' && element.id === target.id
              ? {
                  ...element,
                  values: normalized.values,
                  element_ids: normalized.elementIds,
                  position: {
                    ...element.position,
                    y: element.position.y + positionShift,
                  },
                }
              : element,
          ),
      )
      setSelectedCellIds(new Set([target.element_ids[index]]))
      if (finalIndex >= 0) {
        cellEditRef.current = { arrayId: target.id, index: finalIndex, hasTyped: true }
        setSelectedCell(finalIndex)
      }
      return
    }

    if (target.kind !== 'array') return
    const startIndex =
      cellEditRef.current?.arrayId === target.id ? cellEditRef.current.index : (selectedCell ?? 0)
    const start = target.layout === 'map' ? Math.floor(startIndex / 2) * 2 : Math.max(0, startIndex)
    const values = [...target.values]
    const elementIds = [...target.element_ids]
    const pastedValues = [...clipboard.values]
    if (target.layout === 'map' && pastedValues.length % 2 !== 0) pastedValues.push('')
    const addedCount = Math.max(0, start + pastedValues.length - values.length)
    for (let index = 0; index < addedCount; index += 1) {
      values.push('')
      elementIds.push(nextId + index)
    }
    pastedValues.forEach((value, offset) => {
      values[start + offset] = value
    })
    const preferredIds = new Set(elementIds.slice(start, start + pastedValues.length))
    const isUniqueCollection =
      target.layout === 'map' || (target.layout === 'vertical' && target.label === 'set')
    const normalized = isUniqueCollection
      ? normalizeCollectionValues(target, values, elementIds, preferredIds)
      : { values, elementIds, removedCellIds: new Set<number>() }
    const activeCellId = [...preferredIds].find((cellId) => normalized.elementIds.includes(cellId))
    const activeIndex =
      activeCellId === undefined ? -1 : normalized.elementIds.indexOf(activeCellId)
    const removedBefore =
      activeCellId === undefined
        ? 0
        : elementIds
            .slice(0, elementIds.indexOf(activeCellId))
            .filter((cellId) => normalized.removedCellIds.has(cellId)).length
    const positionShift =
      target.layout === 'map'
        ? (removedBefore / 2) * CELL_SIZE
        : target.layout === 'vertical'
          ? removedBefore * CELL_SIZE
          : 0
    setElements((current) =>
      current
        .filter(
          (element) =>
            !(element.kind === 'iterator' && normalized.removedCellIds.has(element.hostId)),
        )
        .map((element) =>
          element.kind === 'array' && element.id === target.id
            ? {
                ...element,
                values: normalized.values,
                element_ids: normalized.elementIds,
                position: { ...element.position, y: element.position.y + positionShift },
              }
            : element,
        ),
    )
    if (addedCount > 0) setNextId((current) => current + addedCount)
    if (activeCellId !== undefined && activeIndex >= 0) {
      setSelectedCellIds(new Set([activeCellId]))
      setSelectedCell(activeIndex)
      cellEditRef.current = { arrayId: target.id, index: activeIndex, hasTyped: true }
    }
  }, [
    cellEditRef,
    clipboardRef,
    elementEditRef,
    elements,
    nextId,
    selectedCell,
    selectedCellIds,
    selectedIds,
    setElements,
    setNextId,
    setSelectedCell,
    setSelectedCellIds,
    setSelectedId,
    setSelectedIds,
  ])

  return { copySelection, pasteClipboard }
}
