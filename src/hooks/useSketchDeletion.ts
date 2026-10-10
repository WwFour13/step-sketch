import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CellEditState, SketchArray, SketchElement } from '../types/sketch'

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
  setAppendCellsArrayId: Dispatch<SetStateAction<number | null>>
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
  setAppendCellsArrayId,
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
              if (element.kind === 'array') {
                element.element_ids.forEach((elementId) => deletedIds.add(elementId))
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
    },
    [setElements, setSelectedCell, setSelectedCellIds, setSelectedId, setSelectedIds],
  )

  const deleteSelection = useCallback(() => {
    const arraysById = new Map(
      elements
        .filter((element): element is SketchArray => element.kind === 'array')
        .map((array) => [array.id, array]),
    )
    const fullySelectedArrays = new Set<number>()
    const partiallySelectedArrayIds = new Set<number>()
    selectedCellIds.forEach((cellId) => {
      const array = [...arraysById.values()].find((item) => item.element_ids.includes(cellId))
      if (array) partiallySelectedArrayIds.add(array.id)
    })
    partiallySelectedArrayIds.forEach((arrayId) => {
      const array = arraysById.get(arrayId)
      if (array && array.element_ids.every((cellId) => selectedCellIds.has(cellId))) {
        fullySelectedArrays.add(arrayId)
      }
    })
    const retainedMatrixCellIds = new Set<number>()
    partiallySelectedArrayIds.forEach((arrayId) => {
      const array = arraysById.get(arrayId)
      if (array?.layout === 'matrix' && !fullySelectedArrays.has(arrayId)) {
        array.element_ids.forEach((cellId) => {
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
        if (element.kind === 'array') {
          element.element_ids.forEach((cellId) => removedCellIds.add(cellId))
        }
        return []
      }
      if (element.kind !== 'array' || !partiallySelectedArrayIds.has(element.id)) {
        return [element]
      }

      const selectedIndexes = new Set<number>()
      element.element_ids.forEach((cellId, index) => {
        if (selectedCellIds.has(cellId)) selectedIndexes.add(index)
      })
      if (element.layout === 'matrix' && !fullySelectedArrays.has(element.id)) {
        return [element]
      }
      if (element.layout === 'map') {
        for (const index of [...selectedIndexes]) {
          selectedIndexes.add(index % 2 === 0 ? index + 1 : index - 1)
        }
        selectedIndexes.delete(-1)
      }
      const indexes = [...selectedIndexes]
        .filter((index) => index >= 0 && index < element.values.length)
        .sort((a, b) => a - b)
      if (indexes.length === 0) return [element]

      const minimumCellCount = element.layout === 'map' ? 2 : 1
      const remainingCount = element.values.length - indexes.length
      if (remainingCount < minimumCellCount) {
        const values = [...element.values]
        values.fill('')
        element.element_ids.forEach((cellId) => neighboringCellIds.add(cellId))
        return [{ ...element, values }]
      }

      let previousIndex = -2
      const removedRuns: Array<{ start: number; end: number }> = []
      indexes.forEach((index) => {
        if (index > previousIndex + 1) removedRuns.push({ start: index, end: index })
        else removedRuns[removedRuns.length - 1].end = index
        previousIndex = index
        removedCellIds.add(element.element_ids[index])
      })
      removedRuns.forEach(({ start, end }) => {
        const neighborIndexes =
          element.layout === 'map' ? [start - 2, end + 2] : [start - 1, end + 1]
        neighborIndexes.forEach((index) => {
          if (index < 0 || index >= element.element_ids.length || selectedIndexes.has(index)) return
          if (element.layout === 'map') {
            const pairStart = Math.floor(index / 2) * 2
            element.element_ids
              .slice(pairStart, pairStart + 2)
              .forEach((cellId) => neighboringCellIds.add(cellId))
          } else {
            neighboringCellIds.add(element.element_ids[index])
          }
        })
      })
      const values = element.values.filter((_, index) => !selectedIndexes.has(index))
      const elementIds = element.element_ids.filter((_, index) => !selectedIndexes.has(index))
      return [{ ...element, values, element_ids: elementIds }]
    })

    const survivingChildren = [...deletedNodeChildren].filter((id) =>
      nextElements.some((element) => element.id === id && element.kind === 'node'),
    )
    const nextSelectedIds = new Set<number>(survivingChildren)
    const remainingSelectedCellIds = new Set([...neighboringCellIds, ...retainedMatrixCellIds])
    remainingSelectedCellIds.forEach((cellId) => {
      const array = nextElements.find(
        (element): element is SketchArray =>
          element.kind === 'array' && element.element_ids.includes(cellId),
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
      (element): element is SketchArray => element.kind === 'array' && element.id === nextPrimaryId,
    )
    const primaryCellId = primaryArray
      ? [...remainingSelectedCellIds].find((cellId) => primaryArray.element_ids.includes(cellId))
      : undefined
    const primaryCellIndex = primaryCellId
      ? primaryArray?.element_ids.indexOf(primaryCellId)
      : undefined
    if (primaryArray && primaryCellIndex !== undefined && primaryCellIndex >= 0) {
      cellEditRef.current = {
        arrayId: primaryArray.id,
        index: primaryCellIndex,
        hasTyped: false,
        replaceOnly: true,
      }
      setSelectedCell(primaryCellIndex)
    } else {
      cellEditRef.current = null
      setSelectedCell(null)
    }
    elementEditRef.current = null
    setAppendCellsArrayId(null)
  }, [
    elements,
    cellEditRef,
    elementEditRef,
    selectedCellIds,
    selectedIds,
    setAppendCellsArrayId,
    setElements,
    setSelectedCell,
    setSelectedCellIds,
    setSelectedId,
    setSelectedIds,
  ])

  return { deleteElement, deleteSelection }
}
