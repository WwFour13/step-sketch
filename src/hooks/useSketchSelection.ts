import { useCallback, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { CELL_SIZE } from '../constants/sketch'
import type { CellEditState, SketchArray, SketchElement } from '../types/sketch'

export type CellEditConfirmation = {
  arrayId: number
  start: number
  count: number
  adjustedIndex: number
}

type UseSketchSelectionOptions = {
  elements: SketchElement[]
  setElements: Dispatch<SetStateAction<SketchElement[]>>
  cellEditRef: MutableRefObject<CellEditState | null>
  setAppendCellsArrayId: Dispatch<SetStateAction<number | null>>
}

export const useSketchSelection = ({
  elements,
  setElements,
  cellEditRef,
  setAppendCellsArrayId,
}: UseSketchSelectionOptions) => {
  const [selectedId, setSelectedId] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set([1]))
  const [selectedCellIds, setSelectedCellIds] = useState<Set<number>>(new Set())
  const [selectedCell, setSelectedCell] = useState<number | null>(null)

  const confirmCellEdit = useCallback(
    (cellEdit: CellEditState | null): CellEditConfirmation | null => {
      if (!cellEdit) return null

      const array = elements.find(
        (element): element is SketchArray =>
          element.kind === 'array' && element.id === cellEdit.arrayId,
      )
      if (!array) return null

      const isSet = array.layout === 'vertical' && array.label === 'set'
      const isMapKey = array.layout === 'map' && cellEdit.index % 2 === 0
      if (!isSet && !isMapKey) return null

      const value = array.values[cellEdit.index]
      if (!value) return null
      const duplicateIndex = array.values.findIndex(
        (candidate, index) =>
          index !== cellEdit.index && (!isMapKey || index % 2 === 0) && candidate === value,
      )
      if (duplicateIndex < 0) return null

      const start = isMapKey ? Math.floor(duplicateIndex / 2) * 2 : duplicateIndex
      const count = isMapKey ? 2 : 1
      const removedCellIds = array.element_ids.slice(start, start + count)
      const adjustedIndex = cellEdit.index > start ? cellEdit.index - count : cellEdit.index
      const keepEditedCellPosition = cellEdit.index > start

      setSelectedCellIds((current) => {
        const next = new Set(current)
        removedCellIds.forEach((cellId) => next.delete(cellId))
        return next
      })
      setElements((current) =>
        current
          .filter(
            (element) => !(element.kind === 'iterator' && removedCellIds.includes(element.hostId)),
          )
          .map((element) => {
            if (element.kind !== 'array' || element.id !== cellEdit.arrayId) return element
            const values = [...element.values]
            const elementIds = [...element.element_ids]
            values.splice(start, count)
            elementIds.splice(start, count)
            return {
              ...element,
              values,
              element_ids: elementIds,
              position: {
                ...element.position,
                y: element.position.y + (keepEditedCellPosition ? CELL_SIZE : 0),
              },
            }
          }),
      )
      setAppendCellsArrayId(null)
      return { arrayId: array.id, start, count, adjustedIndex }
    },
    [elements, setAppendCellsArrayId, setElements, setSelectedCellIds],
  )

  const selectCell = useCallback(
    (arrayId: number, index: number) => {
      const currentEdit = cellEditRef.current
      let selectedIndex = index
      if (!currentEdit || currentEdit.arrayId !== arrayId || currentEdit.index !== index) {
        const confirmed = confirmCellEdit(cellEditRef.current)
        if (confirmed?.arrayId === arrayId) {
          selectedIndex =
            index >= confirmed.start + confirmed.count
              ? index - confirmed.count
              : index >= confirmed.start
                ? confirmed.adjustedIndex
                : index
        }
      }
      cellEditRef.current = { arrayId, index: selectedIndex, hasTyped: false }
      const array = elements.find(
        (element): element is SketchArray => element.kind === 'array' && element.id === arrayId,
      )
      const cellId = array?.element_ids[selectedIndex]
      const preserveCellSelection =
        selectedIds.has(arrayId) &&
        cellId !== undefined &&
        selectedCellIds.has(cellId) &&
        selectedCellIds.size > 1
      if (!preserveCellSelection) {
        setSelectedCellIds(cellId === undefined ? new Set() : new Set([cellId]))
      }
      setAppendCellsArrayId(null)
      setSelectedCell(selectedIndex)
    },
    [cellEditRef, confirmCellEdit, elements, selectedCellIds, selectedIds, setAppendCellsArrayId],
  )

  const selectOne = useCallback(
    (id: number, additive = false) => {
      if (cellEditRef.current && (id !== selectedId || !selectedIds.has(id))) {
        confirmCellEdit(cellEditRef.current)
        cellEditRef.current = null
        setSelectedCell(null)
      }
      if (!additive) {
        setSelectedCell(null)
        setSelectedCellIds(new Set())
      }
      setSelectedIds((current) => {
        const next = additive ? new Set(current) : new Set<number>()
        next.add(id)
        return next
      })
      setSelectedId(id)
    },
    [cellEditRef, confirmCellEdit, selectedId, selectedIds],
  )

  return {
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    selectedCellIds,
    setSelectedCellIds,
    selectedCell,
    setSelectedCell,
    selectCell,
    selectOne,
    confirmCellEdit,
  }
}
