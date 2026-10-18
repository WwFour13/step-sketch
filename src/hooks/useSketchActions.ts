import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { iteratorColors } from '../constants/sketch'
import { buildCanvasElementsFromTestCases } from '../services/leetcodeSketch'
import type { CellEditConfirmation } from './useSketchSelection'
import type {
  CellEditState,
  SketchCollection,
  SketchElement,
  SketchIterator,
  SketchNode,
} from '../types/sketch'
import type { ParsedTestCase } from '../services/leetcodeSketch'
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
  setProblemStatus: Dispatch<SetStateAction<string>>
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
  setProblemStatus,
}: UseSketchActionsOptions) => {
  const addVariable = (kind: 'variable' | 'node') => {
    const id = nextId
    const value = String(Math.floor(Math.random() * 10))
    const position = { x: 130 + (id % 3) * 70, y: 100 + (id % 3) * 60 }
    const element: SketchElement =
      kind === 'node'
        ? { id, kind, value, pointer_ids: [], pointer_limit: '+', position }
        : { id, kind, label: 'variable', value, position }
    setElements((current) => [...current, element])
    setNextId((current) => current + 1)
    selectOne(id)
  }

  const addArray = (values: string[], label: string) => {
    const id = nextId
    const elementIds = values.map((_, index) => id + index + 1)
    setElements((current) => [
      ...current,
      {
        id,
        kind: 'array',
        label,
        element_ids: elementIds,
        values,
        position: { x: 130 + (id % 3) * 70, y: 100 + (id % 3) * 60 },
      },
    ])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
  }

  const addSet = () => {
    const id = nextId
    const values = ['2', '7', '11', '15']
    const elementIds = values.map((_, index) => id + index + 1)
    setElements((current) => [
      ...current,
      {
        id,
        kind: 'set',
        label: 'set',
        element_ids: elementIds,
        values,
        position: { x: 180, y: 120 },
      },
    ])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
  }

  const addMap = () => {
    const id = nextId
    const values = ['name', 'Ada', 'role', 'coder', 'level', '42']
    const elementIds = values.map((_, index) => id + index + 1)
    setElements((current) => [
      ...current,
      {
        id,
        kind: 'map',
        label: 'map',
        element_ids: elementIds,
        values,
        position: { x: 180, y: 120 },
      },
    ])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
  }

  const addLinkedList = () => {
    const firstId = nextId
    const nodes: SketchNode[] = [0, 1, 2].map((index) => ({
      id: firstId + index,
      kind: 'node',
      value: String(index + 1),
      pointer_ids: index < 2 ? [firstId + index + 1] : [],
      pointer_limit: 1,
      position: { x: 140 + index * 120, y: 170 },
    }))
    const count = elements.filter((element) => element.kind === 'iterator').length
    const iteratorId = firstId + nodes.length
    const iterator: SketchIterator = {
      id: iteratorId,
      kind: 'iterator',
      hostId: firstId,
      color: iteratorColors[count % iteratorColors.length],
      mode: 'bottom',
      label: 'head',
    }
    setElements((current) => [...current, ...nodes, iterator])
    setNextId((current) => current + nodes.length + 1)
    selectOne(firstId)
  }

  const addBinaryTree = () => {
    const firstId = nextId
    const positions = [
      { x: 330, y: 110 },
      { x: 200, y: 240 },
      { x: 460, y: 240 },
      { x: 135, y: 370 },
      { x: 265, y: 370 },
      { x: 395, y: 370 },
      { x: 525, y: 370 },
    ]
    const nodes: SketchNode[] = [0, 1, 2, 3, 4, 5, 6].map((index) => {
      const leftId = firstId + index * 2 + 1
      const rightId = firstId + index * 2 + 2
      const pointerIds = [leftId, rightId].filter((pointerId) => pointerId < firstId + 7)
      return {
        id: firstId + index,
        kind: 'node' as const,
        value: String(index + 1),
        pointer_ids: pointerIds,
        pointer_limit: 2,
        position: positions[index],
      }
    })
    setElements((current) => [...current, ...nodes])
    setNextId((current) => current + nodes.length)
    selectOne(firstId)
  }

  const addMatrix = () => {
    const id = nextId
    const values = Array.from({ length: 9 }, (_, index) => String(index + 1))
    setElements((current) => [
      ...current,
      {
        id,
        kind: 'matrix',
        label: 'matrix',
        element_ids: [0, 1, 2].map((row) =>
          values.slice(row * 3, row * 3 + 3).map((_, column) => id + row * 3 + column + 1),
        ),
        values: [values.slice(0, 3), values.slice(3, 6), values.slice(6, 9)],
        position: { x: 180, y: 120 },
        columns: 3,
      },
    ])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
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

  const handleImportTestCases = (selectedCases: ParsedTestCase[], problemTitle: string) => {
    const maxY = elements.reduce((acc, element) => {
      if (element.kind === 'iterator') return acc
      return Math.max(acc, element.position.y + 110)
    }, 60)
    const startY = Math.max(100, maxY + 30)
    const result = buildCanvasElementsFromTestCases(selectedCases, nextId, startY)
    setElements((current) => [...current, ...result.elements])
    setNextId(result.nextId)

    const firstElement = result.elements[0]
    if (firstElement) {
      setSelectedIds(new Set(result.elements.map((element) => element.id)))
      setSelectedId(firstElement.id)
    }

    setProblemStatus(
      `${problemTitle} (${selectedCases.length} ${selectedCases.length === 1 ? 'case' : 'cases'} imported)`,
    )
  }

  const updateSelected = (patch: Partial<SketchElement>) => {
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
