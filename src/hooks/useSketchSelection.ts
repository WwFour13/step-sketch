import { useCallback, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { CELL_SIZE } from '../constants/sketch'
import type { CellEditState, SketchCollection, SketchElement } from '../types/sketch'
import {
  getCollectionElementIds,
  getCollectionValues,
  isSketchCollection,
  withCollectionCells,
} from '../utils/sketchCollections'

export type CellEditConfirmation = {
  arrayId: number
  start?: number
  count?: number
  adjustedIndex?: number
  valueChanged?: boolean
}

type UseSketchSelectionOptions = {
  elements: SketchElement[]
  setElements: Dispatch<SetStateAction<SketchElement[]>>
  cellEditRef: MutableRefObject<CellEditState | null>
}

export const useSketchSelection = ({
  elements,
  setElements,
  cellEditRef,
}: UseSketchSelectionOptions) => {
  const [selectedId, setSelectedId] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set([1]))
  const [selectedCellIds, setSelectedCellIds] = useState<Set<number>>(new Set())
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [isInsertBefore, setIsInsertBefore] = useState(false)

  const confirmCellEdit = useCallback(
    (cellEdit: CellEditState | null): CellEditConfirmation | null => {
      if (!cellEdit) return null

      const array = elements.find(
        (element): element is SketchCollection =>
          isSketchCollection(element) && element.id === cellEdit.arrayId,
      )
      if (!array) return null

      const values = getCollectionValues(array)
      const elementIds = getCollectionElementIds(array)
      const currentValue = values[cellEdit.index] ?? ''
      const initialValue = cellEdit.initialValue ?? ''
      let valueChanged = cellEdit.hasTyped && currentValue !== initialValue

      if (array.kind === 'array' && array.input_type === 'number') {
        const isValidNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(currentValue)
        if (currentValue && !isValidNumber) {
          setElements((current) =>
            current.map((element) => {
              if (element.kind !== 'array' || element.id !== array.id) return element
              const nextValues = [...getCollectionValues(element)]
              if (cellEdit.index >= nextValues.length) return element
              nextValues[cellEdit.index] = ''
              return withCollectionCells(element, nextValues, getCollectionElementIds(element))
            }),
          )
          valueChanged = true
        }
        return valueChanged ? { arrayId: array.id, valueChanged: true } : null
      }

      const isSet = array.kind === 'set'
      const isMapKey = array.kind === 'map' && cellEdit.index % 2 === 0
      if (!isSet && !isMapKey) {
        return valueChanged ? { arrayId: array.id, valueChanged: true } : null
      }

      if (!currentValue) {
        return valueChanged ? { arrayId: array.id, valueChanged: true } : null
      }

      const duplicateIndex = values.findIndex(
        (candidate, index) =>
          index !== cellEdit.index && (!isMapKey || index % 2 === 0) && candidate === currentValue,
      )
      if (duplicateIndex < 0) {
        return valueChanged ? { arrayId: array.id, valueChanged: true } : null
      }

      const start = isMapKey ? Math.floor(duplicateIndex / 2) * 2 : duplicateIndex
      const count = isMapKey ? 2 : 1
      const removedCellIds = elementIds.slice(start, start + count)
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
            if (!isSketchCollection(element) || element.id !== cellEdit.arrayId) return element
            const nextValues = [...getCollectionValues(element)]
            const nextElementIds = [...getCollectionElementIds(element)]
            nextValues.splice(start, count)
            nextElementIds.splice(start, count)
            const updated = withCollectionCells(element, nextValues, nextElementIds)
            return {
              ...updated,
              position: {
                ...updated.position,
                y: updated.position.y + (keepEditedCellPosition ? CELL_SIZE : 0),
              },
            }
          }),
      )
      return { arrayId: array.id, start, count, adjustedIndex, valueChanged: true }
    },
    [elements, setElements, setSelectedCellIds],
  )

  const selectCell = useCallback(
    (arrayId: number, index: number, additive = false) => {
      const currentEdit = cellEditRef.current
      let selectedIndex = index
      if (!currentEdit || currentEdit.arrayId !== arrayId || currentEdit.index !== index) {
        const confirmed = confirmCellEdit(cellEditRef.current)
        if (
          confirmed?.start !== undefined &&
          confirmed?.count !== undefined &&
          confirmed?.arrayId === arrayId
        ) {
          selectedIndex =
            index >= confirmed.start + confirmed.count
              ? index - confirmed.count
              : index >= confirmed.start
                ? (confirmed.adjustedIndex ?? index)
                : index
        }
      }
      const array = elements.find(
        (element): element is SketchCollection =>
          isSketchCollection(element) && element.id === arrayId,
      )
      const currentValues = array ? getCollectionValues(array) : []
      const initialValue = currentValues[selectedIndex] ?? ''

      cellEditRef.current = additive
        ? null
        : { arrayId, index: selectedIndex, hasTyped: false, initialValue }
      const cellId = array ? getCollectionElementIds(array)[selectedIndex] : undefined
      if (additive) {
        if (cellId !== undefined) {
          setSelectedCellIds((current) => {
            const next = new Set(current)
            if (next.has(cellId)) {
              next.delete(cellId)
            } else {
              next.add(cellId)
            }
            return next
          })
          setSelectedIds((current) => {
            const next = new Set(current)
            next.add(arrayId)
            return next
          })
          setSelectedId(arrayId)
        }
        setSelectedCell(null)
      } else {
        const preserveCellSelection =
          selectedIds.has(arrayId) &&
          cellId !== undefined &&
          selectedCellIds.has(cellId) &&
          selectedCellIds.size > 1
        if (!preserveCellSelection) {
          setSelectedCellIds(cellId === undefined ? new Set() : new Set([cellId]))
        }
        setSelectedCell(selectedIndex)
      }
      setIsInsertBefore(false)
    },
    [cellEditRef, confirmCellEdit, elements, selectedCellIds, selectedIds],
  )

  const selectOne = useCallback(
    (id: number, additive = false) => {
      setIsInsertBefore(false)
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
    isInsertBefore,
    setIsInsertBefore,
    selectCell,
    selectOne,
    confirmCellEdit,
  }
}
