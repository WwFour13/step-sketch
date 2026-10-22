import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CellEditState, SketchCollection, SketchElement } from '../types/sketch'
import {
  getCollectionElementIds,
  getCollectionValues,
  isSketchCollection,
  withCollectionCells,
} from '../utils/sketchCollections'

type UseSketchDeletionOptions = {
  elements: SketchElement[]
  setElements: Dispatch<SetStateAction<SketchElement[]>>
  selectedIds: Set<number>
  setSelectedIds: Dispatch<SetStateAction<Set<number>>>
  selectedCellIds: Set<number>
  setSelectedCellIds: Dispatch<SetStateAction<Set<number>>>
  setSelectedId: Dispatch<SetStateAction<number>>
  setSelectedCell: Dispatch<SetStateAction<number | null>>
  cellEditRef: MutableRefObject<CellEditState | null>
  elementEditRef: MutableRefObject<{ elementId: number; hasTyped: boolean } | null>
}

export const useSketchDeletion = ({
  elements,
  setElements,
  selectedIds,
  setSelectedIds,
  selectedCellIds,
  setSelectedCellIds,
  setSelectedId,
  setSelectedCell,
  cellEditRef,
  elementEditRef,
}: UseSketchDeletionOptions) => {
  /**
   * Deletes the requested element, or the full current selection when it
   * includes that element. Also removes array cells, hosted iterators, and
   * node pointers that refer to deleted IDs.
   * @param id ID of the element whose deletion was requested.
   */
  const deleteElement = useCallback(
    (id: number) => {
      setSelectedIds((currentSelected) => {
        const idsToDelete = new Set(currentSelected.has(id) ? currentSelected : [id])
        setElements((current) => {
          const deletedIds = new Set<number>()
          current.forEach((element) => {
            if (idsToDelete.has(element.id)) {
              deletedIds.add(element.id)
              if (isSketchCollection(element)) {
                getCollectionElementIds(element).forEach((elementId) => deletedIds.add(elementId))
              }
            }
          })
          return current
            .filter(
              (item) =>
                !deletedIds.has(item.id) &&
                !(item.kind === 'iterator' && deletedIds.has(item.hostId)),
            )
            .map((item) =>
              item.kind === 'node'
                ? {
                    ...item,
                    pointer_ids: item.pointer_ids.filter((pointerId) => !deletedIds.has(pointerId)),
                  }
                : item,
            )
        })
        return new Set()
      })
      setSelectedId(0)
      setSelectedCell(null)
      setSelectedCellIds(new Set())
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    },
    [setElements, setSelectedCell, setSelectedCellIds, setSelectedId, setSelectedIds],
  )

  const deleteSelection = useCallback(() => {
    const arraysById = new Map(
      elements.filter(isSketchCollection).map((array) => [array.id, array]),
    )
    const fullySelectedArrays = new Set<number>()
    const partiallySelectedArrayIds = new Set<number>()
    selectedCellIds.forEach((cellId) => {
      const array = [...arraysById.values()].find((item) =>
        getCollectionElementIds(item).includes(cellId),
      )
      if (array) partiallySelectedArrayIds.add(array.id)
    })
    partiallySelectedArrayIds.forEach((arrayId) => {
      const array = arraysById.get(arrayId)
      if (array && getCollectionElementIds(array).every((cellId) => selectedCellIds.has(cellId))) {
        fullySelectedArrays.add(arrayId)
      }
    })
    const retainedMatrixCellIds = new Set<number>()
    partiallySelectedArrayIds.forEach((arrayId) => {
      const array = arraysById.get(arrayId)
      if (array?.kind === 'matrix' && !fullySelectedArrays.has(arrayId)) {
        getCollectionElementIds(array).forEach((cellId) => {
          if (selectedCellIds.has(cellId)) retainedMatrixCellIds.add(cellId)
        })
      }
    })
    const fullDeleteIds = new Set([
      ...[...selectedIds].filter((id) => !partiallySelectedArrayIds.has(id)),
      ...fullySelectedArrays,
    ])
    const deletedNodeChildren = new Set<number>()
    elements.forEach((element) => {
      if (fullDeleteIds.has(element.id) && element.kind === 'node') {
        element.pointer_ids.forEach((childId) => deletedNodeChildren.add(childId))
      }
    })

    const neighboringCellIds = new Set<number>()
    const removedCellIds = new Set<number>()
    const nextElements = elements.flatMap((element): SketchElement[] => {
      if (element.kind === 'iterator') {
        return fullDeleteIds.has(element.id) ? [] : [element]
      }
      if (fullDeleteIds.has(element.id)) {
        if (isSketchCollection(element)) {
          getCollectionElementIds(element).forEach((cellId) => removedCellIds.add(cellId))
        }
        return []
      }
      if (!isSketchCollection(element) || !partiallySelectedArrayIds.has(element.id)) {
        return [element]
      }

      const elementIds = getCollectionElementIds(element)
      const values = getCollectionValues(element)
      const selectedIndexes = new Set<number>()
      elementIds.forEach((cellId, index) => {
        if (selectedCellIds.has(cellId)) selectedIndexes.add(index)
      })
      if (element.kind === 'matrix' && !fullySelectedArrays.has(element.id)) {
        return [element]
      }
      if (element.kind === 'map') {
        for (const index of [...selectedIndexes]) {
          selectedIndexes.add(index % 2 === 0 ? index + 1 : index - 1)
        }
        selectedIndexes.delete(-1)
      }
      const indexes = [...selectedIndexes]
        .filter((index) => index >= 0 && index < values.length)
        .sort((a, b) => a - b)
      if (indexes.length === 0) return [element]

      const minimumCellCount = element.kind === 'map' ? 2 : 1
      const remainingCount = values.length - indexes.length
      if (remainingCount < minimumCellCount) {
        const emptyValues = [...values]
        emptyValues.fill('')
        elementIds.forEach((cellId) => neighboringCellIds.add(cellId))
        return [withCollectionCells(element, emptyValues, elementIds)]
      }

      let previousIndex = -2
      const removedRuns: Array<{ start: number; end: number }> = []
      indexes.forEach((index) => {
        if (index > previousIndex + 1) removedRuns.push({ start: index, end: index })
        else removedRuns[removedRuns.length - 1].end = index
        previousIndex = index
        removedCellIds.add(elementIds[index])
      })
      removedRuns.forEach(({ start, end }) => {
        const neighborIndexes = element.kind === 'map' ? [start - 2, end + 2] : [start - 1, end + 1]
        neighborIndexes.forEach((index) => {
          if (index < 0 || index >= elementIds.length || selectedIndexes.has(index)) return
          if (element.kind === 'map') {
            const pairStart = Math.floor(index / 2) * 2
            elementIds
              .slice(pairStart, pairStart + 2)
              .forEach((cellId) => neighboringCellIds.add(cellId))
          } else {
            neighboringCellIds.add(elementIds[index])
          }
        })
      })
      const nextValues = values.filter((_, index) => !selectedIndexes.has(index))
      const nextElementIds = elementIds.filter((_, index) => !selectedIndexes.has(index))
      return [withCollectionCells(element, nextValues, nextElementIds)]
    })

    const survivingChildren = [...deletedNodeChildren].filter((id) =>
      nextElements.some((element) => element.id === id && element.kind === 'node'),
    )
    const nextSelectedIds = new Set<number>(survivingChildren)
    const remainingSelectedCellIds = new Set([...neighboringCellIds, ...retainedMatrixCellIds])
    remainingSelectedCellIds.forEach((cellId) => {
      const array = nextElements.find(
        (element): element is SketchCollection =>
          isSketchCollection(element) && getCollectionElementIds(element).includes(cellId),
      )
      if (array) nextSelectedIds.add(array.id)
    })
    const cleanedElements = nextElements
      .filter(
        (element) =>
          !(
            element.kind === 'iterator' &&
            (removedCellIds.has(element.hostId) || fullDeleteIds.has(element.hostId))
          ),
      )
      .map((element) =>
        element.kind === 'node'
          ? {
              ...element,
              pointer_ids: element.pointer_ids.filter((pointerId) => !fullDeleteIds.has(pointerId)),
            }
          : element,
      )

    setElements(cleanedElements)
    setSelectedIds(nextSelectedIds)
    setSelectedCellIds(remainingSelectedCellIds)
    const nextPrimaryId = nextSelectedIds.values().next().value ?? 0
    setSelectedId(nextPrimaryId)
    const primaryArray = cleanedElements.find(
      (element): element is SketchCollection =>
        isSketchCollection(element) && element.id === nextPrimaryId,
    )
    const primaryArrayIds = primaryArray ? getCollectionElementIds(primaryArray) : []
    const primaryCellId = primaryArray
      ? [...remainingSelectedCellIds].find((cellId) => primaryArrayIds.includes(cellId))
      : undefined
    const primaryCellIndex = primaryCellId ? primaryArrayIds.indexOf(primaryCellId) : undefined
    if (primaryArray && primaryCellIndex !== undefined && primaryCellIndex >= 0) {
      cellEditRef.current = {
        arrayId: primaryArray.id,
        index: primaryCellIndex,
        hasTyped: false,
      }
      setSelectedCell(primaryCellIndex)
    } else {
      cellEditRef.current = null
      setSelectedCell(null)
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
    elementEditRef.current = null
  }, [
    elements,
    cellEditRef,
    elementEditRef,
    selectedCellIds,
    selectedIds,
    setElements,
    setSelectedCell,
    setSelectedCellIds,
    setSelectedId,
    setSelectedIds,
  ])

  return { deleteElement, deleteSelection }
}
