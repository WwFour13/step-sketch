import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { CELL_SIZE } from '../constants/sketch'
import { buildCanvasElementsFromTestCases } from '../services/leetcodeSketch'
import type { CellEditConfirmation } from './useSketchSelection'
import type {
  CanvasDimensions,
  CanvasViewport,
  CellEditState,
  Position,
  SketchArrayInputType,
  SketchCollection,
  SketchElement,
  SketchNode,
} from '../types/sketch'
import type { ParsedTestCase } from '../services/leetcodeSketch'
import { elementBounds } from '../utils/canvas'
import { findNonOverlappingSpawnPosition } from '../utils/canvasState'
import { createTemplateElements, TEMPLATE_DEFINITIONS } from '../utils/sketchTemplates'
import {
  getCollectionElementIds,
  isSketchCollection,
  withCollectionCells,
} from '../utils/sketchCollections'

type UseSketchActionsOptions = {
  elements: SketchElement[]
  setElements: Dispatch<SetStateAction<SketchElement[]>>
  nextId: number
  setNextId: Dispatch<SetStateAction<number>>
  selected: SketchElement | undefined
  selectedId: number
  selectOne: (id: number) => void
  setSelectedIds: Dispatch<SetStateAction<Set<number>>>
  setSelectedId: Dispatch<SetStateAction<number>>
  cellEditRef: MutableRefObject<CellEditState | null>
  confirmCellEdit: (cellEdit: CellEditState | null) => CellEditConfirmation | null
  setSelectedCell: Dispatch<SetStateAction<number | null>>
  setIsLeetCodeModalOpen: Dispatch<SetStateAction<boolean>>
  viewport?: CanvasViewport
  setViewport?: Dispatch<SetStateAction<CanvasViewport>>
  dimensions?: CanvasDimensions
  screenDimensions?: { width: number; height: number }
}

export const useSketchActions = ({
  elements,
  setElements,
  nextId,
  setNextId,
  selected,
  selectedId,
  selectOne,
  setSelectedIds,
  setSelectedId,
  cellEditRef,
  confirmCellEdit,
  setSelectedCell,
  setIsLeetCodeModalOpen,
  viewport,
  setViewport,
  dimensions,
  screenDimensions,
}: UseSketchActionsOptions) => {
  const getSpawnPosition = (size: { width: number; height: number }): Position => {
    const result = findNonOverlappingSpawnPosition(
      elements,
      size,
      dimensions,
      viewport,
      screenDimensions,
    )
    if (result.adjustedViewport && setViewport) {
      setViewport(result.adjustedViewport)
    }
    return result.position
  }

  const addVariable = (kind: 'variable' | 'node') => {
    const position = getSpawnPosition(TEMPLATE_DEFINITIONS[kind].size)
    const { elements: newElements, nextId: newNextId, primaryId } = createTemplateElements(
      kind,
      nextId,
      position,
    )
    setElements((current) => [...current, ...newElements])
    setNextId(newNextId)
    selectOne(primaryId)
  }

  const addArray = (
    values: string[],
    label: string,
    inputType?: SketchArrayInputType,
  ) => {
    const id = nextId
    const elementIds = values.map((_, index) => id + index + 1)
    const resolvedInputType: SketchArrayInputType =
      inputType ??
      (label.toLowerCase() === 'text' ||
      label.toLowerCase().includes('str') ||
      label.toLowerCase().includes('word') ||
      (values.length > 0 && values.some((val) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(val)))
        ? 'character'
        : 'number')
    const position = getSpawnPosition({
      width: Math.max(1, values.length) * CELL_SIZE,
      height: CELL_SIZE,
    })
    setElements((current) => [
      ...current,
      {
        id,
        kind: 'array',
        label,
        input_type: resolvedInputType,
        element_ids: elementIds,
        values,
        position,
      },
    ])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
  }

  const addSet = () => {
    const position = getSpawnPosition(TEMPLATE_DEFINITIONS.set.size)
    const { elements: newElements, nextId: newNextId, primaryId } = createTemplateElements(
      'set',
      nextId,
      position,
    )
    setElements((current) => [...current, ...newElements])
    setNextId(newNextId)
    selectOne(primaryId)
  }

  const addMap = () => {
    const position = getSpawnPosition(TEMPLATE_DEFINITIONS.map.size)
    const { elements: newElements, nextId: newNextId, primaryId } = createTemplateElements(
      'map',
      nextId,
      position,
    )
    setElements((current) => [...current, ...newElements])
    setNextId(newNextId)
    selectOne(primaryId)
  }

  const addLinkedList = () => {
    const position = getSpawnPosition(TEMPLATE_DEFINITIONS['linked-list'].size)
    const count = elements.filter((element) => element.kind === 'iterator').length
    const { elements: newElements, nextId: newNextId, primaryId } = createTemplateElements(
      'linked-list',
      nextId,
      position,
      count,
    )
    setElements((current) => [...current, ...newElements])
    setNextId(newNextId)
    const selectableIds = newElements
      .filter((element) => element.kind !== 'iterator')
      .map((element) => element.id)
    setSelectedIds(new Set(selectableIds))
    setSelectedId(primaryId)
    setSelectedCell(null)
  }

  const addBinaryTree = () => {
    const position = getSpawnPosition(TEMPLATE_DEFINITIONS['binary-tree'].size)
    const { elements: newElements, nextId: newNextId, primaryId } = createTemplateElements(
      'binary-tree',
      nextId,
      position,
    )
    setElements((current) => [...current, ...newElements])
    setNextId(newNextId)
    const selectableIds = newElements
      .filter((element) => element.kind !== 'iterator')
      .map((element) => element.id)
    setSelectedIds(new Set(selectableIds))
    setSelectedId(primaryId)
    setSelectedCell(null)
  }

  const addMatrix = () => {
    const position = getSpawnPosition(TEMPLATE_DEFINITIONS.matrix.size)
    const { elements: newElements, nextId: newNextId, primaryId } = createTemplateElements(
      'matrix',
      nextId,
      position,
    )
    setElements((current) => [...current, ...newElements])
    setNextId(newNextId)
    selectOne(primaryId)
  }

  const openLeetCodeModal = () => {
    confirmCellEdit(cellEditRef.current)
    cellEditRef.current = null
    setSelectedCell(null)
    setIsLeetCodeModalOpen(true)
  }

  const closeLeetCodeModal = () => {
    setIsLeetCodeModalOpen(false)
  }

  const handleImportTestCases = (selectedCases: ParsedTestCase[], _problemTitle?: string) => {
    const tempResult = buildCanvasElementsFromTestCases(selectedCases, nextId, 0)
    const nonIterators = tempResult.elements.filter((el) => el.kind !== 'iterator')
    if (nonIterators.length === 0) return

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const el of nonIterators) {
      const b = elementBounds(el)
      if (b.x < minX) minX = b.x
      if (b.y < minY) minY = b.y
      if (b.x + b.width > maxX) maxX = b.x + b.width
      if (b.y + b.height > maxY) maxY = b.y + b.height
    }
    const groupWidth = Math.max(CELL_SIZE, maxX - minX)
    const groupHeight = Math.max(CELL_SIZE, maxY - minY)
    const targetPos = getSpawnPosition({ width: groupWidth, height: groupHeight })
    const deltaX = targetPos.x - minX
    const deltaY = targetPos.y - minY

    const shiftedElements = tempResult.elements.map((el) => {
      if (el.kind === 'iterator') return el
      return {
        ...el,
        position: {
          x: el.position.x + deltaX,
          y: el.position.y + deltaY,
        },
      }
    })
    setElements((current) => [...current, ...shiftedElements])
    setNextId(tempResult.nextId)

    const firstElement = shiftedElements[0]
    if (firstElement) {
      setSelectedIds(new Set(shiftedElements.map((element) => element.id)))
      setSelectedId(firstElement.id)
    }
  }

  const updateSelected = (patch: Partial<SketchElement>) => {
    if (
      selected?.kind === 'array' &&
      'input_type' in patch &&
      (patch.input_type === 'number' || patch.input_type === 'character')
    ) {
      const inputType = patch.input_type
      confirmCellEdit(cellEditRef.current)
      cellEditRef.current = null
      setSelectedCell(null)
      setElements((current) =>
        current.map((element) =>
          element.kind === 'array' && element.id === selectedId
            ? { ...element, input_type: inputType }
            : element,
        ),
      )
      return
    }
    if (
      selected &&
      isSketchCollection(selected) &&
      'values' in patch &&
      Array.isArray(patch.values)
    ) {
      const patchedValues = patch.values as string[] | string[][]
      const values = Array.isArray(patchedValues[0])
        ? (patchedValues as string[][]).flat()
        : (patchedValues as string[])
      const oldElementIds = getCollectionElementIds(selected)
      const addedCellCount = Math.max(0, values.length - oldElementIds.length)
      const removedCellIds = new Set(oldElementIds.slice(values.length))
      const updatedColumns =
        selected.kind === 'matrix' && 'columns' in patch && typeof patch.columns === 'number'
          ? patch.columns
          : selected.kind === 'matrix'
            ? selected.columns
            : undefined
      setElements(
        (current) =>
          current
            .filter(
              (element) => !(element.kind === 'iterator' && removedCellIds.has(element.hostId)),
            )
            .map((element) => {
              if (element.id !== selectedId || !isSketchCollection(element)) return element
              const elementIds = values.map(
                (_, index) => oldElementIds[index] ?? nextId + index - oldElementIds.length,
              )
              const collection =
                element.kind === 'matrix' && updatedColumns !== undefined
                  ? ({ ...element, columns: updatedColumns } as SketchCollection)
                  : element
              return withCollectionCells(collection, values, elementIds)
            }) as SketchElement[],
      )
      if (addedCellCount > 0) setNextId((current) => current + addedCellCount)
      return
    }
    setElements(
      (current) =>
        current.map((element) => {
          if (element.id !== selectedId) return element
          if (element.kind === 'node') {
            const updatedNode: SketchNode = { ...element }
            if ('value' in patch && typeof patch.value === 'string') {
              updatedNode.value = patch.value
            }
            if ('position' in patch && patch.position) {
              updatedNode.position = patch.position
            }
            if ('pointer_ids' in patch && Array.isArray(patch.pointer_ids)) {
              updatedNode.pointer_ids = patch.pointer_ids
            }
            if ('pointer_limit' in patch && patch.pointer_limit) {
              updatedNode.pointer_limit = patch.pointer_limit
              if (patch.pointer_limit !== '+') {
                updatedNode.pointer_ids = updatedNode.pointer_ids.slice(0, patch.pointer_limit)
              }
            }
            return updatedNode
          }
          return { ...element, ...patch }
        }) as SketchElement[],
    )
  }

  return {
    addVariable,
    addArray,
    addSet,
    addMap,
    addLinkedList,
    addBinaryTree,
    addMatrix,
    openLeetCodeModal,
    closeLeetCodeModal,
    handleImportTestCases,
    updateSelected,
  }
}
