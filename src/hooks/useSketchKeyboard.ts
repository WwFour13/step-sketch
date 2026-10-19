import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CellEditState, SketchCollection, SketchElement } from '../types/sketch'
import type { CellEditConfirmation } from './useSketchSelection'
import {
  getCollectionElementIds,
  getCollectionValues,
  isSketchCollection,
  withCollectionCells,
} from '../utils/sketchCollections'

type UseSketchKeyboardOptions = {
  elements: SketchElement[]
  setElements: Dispatch<SetStateAction<SketchElement[]>>
  nextId: number
  setNextId: Dispatch<SetStateAction<number>>
  isLeetCodeModalOpen: boolean
  cellEditRef: MutableRefObject<CellEditState | null>
  confirmCellEditRef: MutableRefObject<
    (cellEdit: CellEditState | null) => CellEditConfirmation | null
  >
  elementEditRef: MutableRefObject<{ elementId: number; hasTyped: boolean } | null>
  deleteElement: (id: number) => void
  deleteSelection: () => void
  copySelection: () => void
  pasteClipboard: () => void
  selectedCellIds: Set<number>
  selectedId: number
  selectedIds: Set<number>
  setSelectedCell: Dispatch<SetStateAction<number | null>>
  setSelectedCellIds: Dispatch<SetStateAction<Set<number>>>
  resetCellTyping: () => void
  setIsInsertBefore: Dispatch<SetStateAction<boolean>>
}

export const useSketchKeyboard = ({
  elements,
  setElements,
  nextId,
  setNextId,
  isLeetCodeModalOpen,
  cellEditRef,
  confirmCellEditRef,
  elementEditRef,
  deleteElement,
  deleteSelection,
  copySelection,
  pasteClipboard,
  selectedCellIds,
  selectedId,
  selectedIds,
  setSelectedCell,
  setSelectedCellIds,
  resetCellTyping,
  setIsInsertBefore,
}: UseSketchKeyboardOptions) => {
  useEffect(() => {
    /**
     * Handles Delete and cell-value typing while avoiding interference with
     * text inputs or the open LeetCode modal.
     * @param event Keyboard event from the browser window.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null
      const cellEdit = cellEditRef.current
      const isArrayCell = activeElement?.classList.contains('array-cell-input') ?? false
      const isCanvasCellEdit = cellEdit !== null && (isArrayCell || activeElement === document.body)
      const isEditing =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        Boolean(activeElement?.isContentEditable) ||
        activeElement?.id === 'label' ||
        activeElement?.id === 'value' ||
        activeElement?.id === 'problem-number' ||
        Boolean(activeElement?.closest('.leetcode-modal-container'))
      const isTypedCharacter =
        event.key.length === 1 &&
        ((!event.ctrlKey && !event.metaKey && !event.altKey) || event.getModifierState('AltGraph'))

      const isClipboardShortcut =
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'v')
      if (isClipboardShortcut) {
        if (isLeetCodeModalOpen || (isEditing && !isArrayCell && !isCanvasCellEdit)) {
          return
        }
        event.preventDefault()
        if (event.key.toLowerCase() === 'c') copySelection()
        else pasteClipboard()
        return
      }

      const isDeletingArrayCell = event.key === 'Delete' && isArrayCell
      if ((isEditing && !isCanvasCellEdit && !isDeletingArrayCell) || isLeetCodeModalOpen) {
        return
      }

      const editingArray = cellEdit
        ? elements.find(
            (element): element is Extract<SketchCollection, { kind: 'array' }> =>
              element.kind === 'array' && element.id === cellEdit.arrayId,
          )
        : undefined
      if (
        cellEdit &&
        isCanvasCellEdit &&
        selectedIds.size === 1 &&
        selectedIds.has(cellEdit.arrayId) &&
        event.key.startsWith('Arrow')
      ) {
        const array = elements.find(
          (element): element is SketchCollection =>
            isSketchCollection(element) && element.id === cellEdit.arrayId,
        )
        if (!array) return

        const values = getCollectionValues(array)
        const elementIds = getCollectionElementIds(array)
        const index = cellEdit.index
        let nextIndex = index
        if (array.kind === 'matrix') {
          const columns = Math.max(1, array.columns)
          const row = Math.floor(index / columns)
          const column = index % columns
          if (event.key === 'ArrowLeft' && column > 0) nextIndex = index - 1
          if (
            event.key === 'ArrowRight' &&
            column + 1 < Math.min(columns, values.length - row * columns)
          ) {
            nextIndex = index + 1
          }
          if (event.key === 'ArrowUp' && row > 0) nextIndex = index - columns
          if (event.key === 'ArrowDown' && index + columns < values.length) {
            nextIndex = index + columns
          }
        } else if (array.kind === 'map') {
          const column = index % 2
          if (event.key === 'ArrowLeft' && column > 0) nextIndex = index - 1
          if (event.key === 'ArrowRight' && column === 0 && index + 1 < values.length) {
            nextIndex = index + 1
          }
          if (event.key === 'ArrowUp' && index >= 2) nextIndex = index - 2
          if (event.key === 'ArrowDown' && index + 2 < values.length) {
            nextIndex = index + 2
          }
        } else if (array.kind === 'set') {
          if (event.key === 'ArrowUp' && index > 0) nextIndex = index - 1
          if (event.key === 'ArrowDown' && index + 1 < values.length) nextIndex = index + 1
        } else {
          if (event.key === 'ArrowLeft') {
            if (cellEdit.insertBefore) {
              event.preventDefault()
              return
            }
            if (index === 0 && array.kind === 'array' && array.input_type === 'character') {
              event.preventDefault()
              cellEditRef.current = { ...cellEdit, insertBefore: true }
              setIsInsertBefore(true)
              return
            }
            if (index > 0) nextIndex = index - 1
          }
          if (event.key === 'ArrowRight') {
            if (cellEdit.insertBefore) {
              event.preventDefault()
              cellEditRef.current = { ...cellEdit, insertBefore: false }
              setIsInsertBefore(false)
              return
            }
            if (index + 1 < values.length) {
              nextIndex = index + 1
            }
          }
        }

        if (cellEdit.insertBefore && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          cellEditRef.current = { ...cellEdit, insertBefore: false }
          setIsInsertBefore(false)
        }

        event.preventDefault()
        if (nextIndex !== index) {
          const confirmed = confirmCellEditRef.current(cellEdit)
          const selectedIndex =
            confirmed?.arrayId === array.id && nextIndex >= confirmed.start + confirmed.count
              ? nextIndex - confirmed.count
              : confirmed?.arrayId === array.id && nextIndex >= confirmed.start
                ? confirmed.adjustedIndex
                : nextIndex
          cellEditRef.current = {
            arrayId: array.id,
            index: selectedIndex,
            hasTyped: false,
            insertBefore: false,
          }
          setIsInsertBefore(false)
          setSelectedCell(selectedIndex)
          setSelectedCellIds(new Set([elementIds[selectedIndex]]))
        }
        return
      }

      if (cellEdit && isCanvasCellEdit && editingArray && selectedIds.has(editingArray.id)) {
        if (selectedCellIds.size > 1 && (event.key === 'Backspace' || event.key === 'Delete')) {
          event.preventDefault()
          deleteSelection()
          return
        }
        const values = [...editingArray.values]
        const elementIds = [...editingArray.element_ids]
        const index = cellEdit.index
        const currentValue = values[index] ?? ''
        const isNumberArray = editingArray.input_type === 'number'
        const setActiveCell = (
          nextIndex: number,
          hasTyped = false,
          insertBefore = false,
          cellIds = elementIds,
        ) => {
          const nextCellId = cellIds[nextIndex]
          cellEditRef.current =
            nextCellId === undefined
              ? null
              : { arrayId: editingArray.id, index: nextIndex, hasTyped, insertBefore }
          setIsInsertBefore(nextCellId === undefined ? false : insertBefore)
          setSelectedCell(nextCellId === undefined ? null : nextIndex)
          setSelectedCellIds(nextCellId === undefined ? new Set() : new Set([nextCellId]))
        }
        const removeCell = (removeIndex: number, preferredIndex: number, insertBefore = false) => {
          const removedCellId = elementIds[removeIndex]
          if (removedCellId === undefined) return
          const nextValues = [...values]
          const nextElementIds = [...elementIds]
          nextValues.splice(removeIndex, 1)
          nextElementIds.splice(removeIndex, 1)
          if (nextElementIds.length === 0) {
            deleteElement(editingArray.id)
            return
          }
          setElements((current) =>
            current
              .filter(
                (element) => !(element.kind === 'iterator' && element.hostId === removedCellId),
              )
              .map((element) => {
                if (element.kind !== 'array' || element.id !== editingArray.id) return element
                return { ...element, values: nextValues, element_ids: nextElementIds }
              }),
          )
          const nextIndex = Math.min(Math.max(0, preferredIndex), nextElementIds.length - 1)
          setActiveCell(nextIndex, false, insertBefore && nextElementIds.length > 0, nextElementIds)
        }

        if (isTypedCharacter) {
          event.preventDefault()
          if (isNumberArray && event.key === ',') {
            confirmCellEditRef.current(cellEdit)
            const insertedIndex = index + 1
            const newCellId = nextId
            const nextElementIds = [...elementIds]
            nextElementIds.splice(insertedIndex, 0, newCellId)
            setElements((current) =>
              current.map((element) => {
                if (element.kind !== 'array' || element.id !== editingArray.id) return element
                const nextValues = [...element.values]
                const nextElementIds = [...element.element_ids]
                nextValues.splice(insertedIndex, 0, '')
                nextElementIds.splice(insertedIndex, 0, newCellId)
                return { ...element, values: nextValues, element_ids: nextElementIds }
              }),
            )
            setNextId((current) => current + 1)
            setActiveCell(insertedIndex, false, false, nextElementIds)
            return
          }

          if (isNumberArray && !/^[0-9.+-]$/.test(event.key)) return
          if (elementIds[index] === undefined) {
            const newCellId = nextId
            const initialValue = event.key
            setElements((current) =>
              current.map((element) =>
                element.kind === 'array' && element.id === editingArray.id
                  ? {
                      ...element,
                      values: [initialValue],
                      element_ids: [newCellId],
                    }
                  : element,
              ),
            )
            setNextId((current) => current + 1)
            setActiveCell(0, true, false, [newCellId])
            return
          }

          if (isNumberArray) {
            values[index] = cellEdit.hasTyped ? currentValue + event.key : event.key
            setElements((current) =>
              current.map((element) =>
                element.kind === 'array' && element.id === editingArray.id
                  ? { ...element, values }
                  : element,
              ),
            )
            setActiveCell(index, true)
            return
          }

          const insertIndex = cellEdit.insertBefore ? index : index + 1
          const newCellId = nextId
          values.splice(insertIndex, 0, event.key)
          elementIds.splice(insertIndex, 0, newCellId)
          setElements((current) =>
            current.map((element) =>
              element.kind === 'array' && element.id === editingArray.id
                ? { ...element, values, element_ids: elementIds }
                : element,
            ),
          )
          setNextId((current) => current + 1)
          setActiveCell(insertIndex, true, false, elementIds)
          return
        }

        if (event.key === 'Escape' && cellEdit.insertBefore) {
          event.preventDefault()
          cellEditRef.current = { ...cellEdit, insertBefore: false }
          setIsInsertBefore(false)
          return
        }

        if (event.key === 'Backspace') {
          event.preventDefault()
          if (cellEdit.insertBefore) {
            cellEditRef.current = { ...cellEdit, insertBefore: false }
            setIsInsertBefore(false)
            return
          }
          if (isNumberArray && currentValue !== '') {
            values[index] = currentValue.slice(0, -1)
            setElements((current) =>
              current.map((element) =>
                element.kind === 'array' && element.id === editingArray.id
                  ? { ...element, values }
                  : element,
              ),
            )
            setActiveCell(index, true)
            return
          }
          removeCell(index, index - 1, !isNumberArray && index === 0)
          return
        }

        if (event.key === 'Delete') {
          event.preventDefault()
          if (cellEdit.insertBefore) {
            cellEditRef.current = { ...cellEdit, insertBefore: false }
            setIsInsertBefore(false)
            return
          }
          if (!isNumberArray) {
            removeCell(index + 1, index)
            return
          }
          removeCell(index, index)
          return
        }
      }

      if (!cellEdit && isCanvasCellEdit === false && selectedIds.size === 1 && isTypedCharacter) {
        const selectedArray = elements.find(
          (element): element is Extract<SketchCollection, { kind: 'array' }> =>
            element.kind === 'array' && selectedIds.has(element.id),
        )
        if (selectedArray && selectedArray.values.length === 0) {
          const isNumberArray = selectedArray.input_type === 'number'
          if (isNumberArray && !/^[0-9.+,-]$/.test(event.key)) return
          event.preventDefault()
          const value = isNumberArray && event.key === ',' ? '' : event.key
          const cellId = nextId
          setElements((current) =>
            current.map((element) =>
              element.kind === 'array' && element.id === selectedArray.id
                ? { ...element, values: [value], element_ids: [cellId] }
                : element,
            ),
          )
          setNextId((current) => current + 1)
          cellEditRef.current = { arrayId: selectedArray.id, index: 0, hasTyped: true }
          setSelectedCell(0)
          setSelectedCellIds(new Set([cellId]))
          return
        }
      }

      if (
        cellEdit &&
        isCanvasCellEdit &&
        !editingArray &&
        (isTypedCharacter || event.key === 'Backspace')
      ) {
        event.preventDefault()
        if (isTypedCharacter && !/^[0-9.-]$/.test(event.key)) {
          const array = elements.find(
            (element): element is SketchCollection =>
              isSketchCollection(element) && element.id === cellEdit.arrayId,
          )
          if (!array) {
            cellEditRef.current = null
            return
          }

          const arrayValues = getCollectionValues(array)
          const arrayElementIds = getCollectionElementIds(array)
          const isAddingCell = event.key === ','
          const isMap = array.kind === 'map'
          const confirmed = isAddingCell ? confirmCellEditRef.current(cellEdit) : null
          const activeIndex =
            confirmed?.arrayId === array.id ? confirmed.adjustedIndex : cellEdit.index
          const insertedIndex = isMap ? (Math.floor(activeIndex / 2) + 1) * 2 : activeIndex + 1
          const insertedCellCount = isMap ? 2 : 1
          if (isAddingCell) {
            setElements((current) =>
              current.map((element) => {
                if (!isSketchCollection(element) || element.id !== cellEdit.arrayId) return element
                const values = [...getCollectionValues(element)]
                const elementIds = [...getCollectionElementIds(element)]
                values.splice(insertedIndex, 0, ...Array(insertedCellCount).fill(''))
                elementIds.splice(
                  insertedIndex,
                  0,
                  ...Array.from({ length: insertedCellCount }, (_, index) => nextId + index),
                )
                return withCollectionCells(element, values, elementIds)
              }),
            )
            setNextId((current) => current + insertedCellCount)
          } else {
            const currentValue = arrayValues[cellEdit.index] ?? ''
            const nextValue = cellEdit.hasTyped ? currentValue + event.key : event.key
            setElements((current) =>
              current.map((element) => {
                if (!isSketchCollection(element) || element.id !== cellEdit.arrayId) return element
                const values = [...getCollectionValues(element)]
                values[cellEdit.index] = nextValue
                return withCollectionCells(element, values, getCollectionElementIds(element))
              }),
            )
          }

          const selectedIndex = isAddingCell
            ? insertedIndex
            : (cellEditRef.current?.index ?? cellEdit.index)
          cellEditRef.current = {
            arrayId: cellEdit.arrayId,
            index: selectedIndex,
            hasTyped: !isAddingCell && selectedIndex === cellEdit.index,
          }
          setSelectedCell(selectedIndex)
          const selectedCellId = isAddingCell ? nextId : arrayElementIds[selectedIndex]
          setSelectedCellIds(new Set([selectedCellId]))
          return
        }

        const currentCollection = elements.find(
          (element): element is SketchCollection =>
            isSketchCollection(element) && element.id === cellEdit.arrayId,
        )
        const currentValue = currentCollection
          ? (getCollectionValues(currentCollection)[cellEdit.index] ?? '')
          : ''
        if (event.key === 'Backspace' && currentValue === '') {
          const array = elements.find(
            (element): element is SketchCollection =>
              isSketchCollection(element) && element.id === cellEdit.arrayId,
          )
          const arrayElementIds = array ? getCollectionElementIds(array) : []
          const arrayValues = array ? getCollectionValues(array) : []
          const removedCellId = arrayElementIds[cellEdit.index]
          if (array && removedCellId !== undefined) {
            if (selectedCellIds.size > 0) {
              event.preventDefault()
              deleteSelection()
              return
            }
            const isMap = array.kind === 'map'
            const pairStart = isMap ? Math.floor(cellEdit.index / 2) * 2 : cellEdit.index
            const removeCount = isMap ? 2 : 1
            const removedCellIds = arrayElementIds.slice(pairStart, pairStart + removeCount)
            const remainingCellCount = arrayValues.length - removedCellIds.length
            if (remainingCellCount < (isMap ? 2 : 1)) {
              const values = [...arrayValues]
              for (let index = pairStart; index < pairStart + removeCount; index += 1) {
                if (index < values.length) values[index] = ''
              }
              cellEditRef.current = {
                ...cellEdit,
                index: pairStart,
                hasTyped: false,
              }
              setElements((current) =>
                current.map((element) =>
                  isSketchCollection(element) && element.id === cellEdit.arrayId
                    ? withCollectionCells(element, values, getCollectionElementIds(element))
                    : element,
                ),
              )
              return
            }

            const nextIndex = Math.max(0, pairStart - (isMap ? 2 : 1))
            setElements((current) =>
              current
                .filter(
                  (element) =>
                    !(element.kind === 'iterator' && removedCellIds.includes(element.hostId)),
                )
                .map((element) => {
                  if (!isSketchCollection(element) || element.id !== cellEdit.arrayId)
                    return element
                  const values = [...getCollectionValues(element)]
                  const elementIds = [...getCollectionElementIds(element)]
                  values.splice(pairStart, removeCount)
                  elementIds.splice(pairStart, removeCount)
                  return withCollectionCells(element, values, elementIds)
                }),
            )
            cellEditRef.current = {
              arrayId: cellEdit.arrayId,
              index: nextIndex,
              hasTyped: false,
            }
            setSelectedCell(nextIndex)
          }
          return
        }
        const nextValue =
          event.key === 'Backspace'
            ? cellEdit.hasTyped
              ? currentValue.slice(0, -1)
              : ''
            : cellEdit.hasTyped
              ? currentValue + event.key
              : event.key
        cellEdit.hasTyped = true
        setElements((current) =>
          current.map((element) => {
            if (
              !isSketchCollection(element) ||
              element.id !== cellEdit.arrayId ||
              cellEdit.index >= getCollectionValues(element).length
            ) {
              return element
            }
            const values = [...getCollectionValues(element)]
            values[cellEdit.index] = nextValue
            return withCollectionCells(element, values, getCollectionElementIds(element))
          }),
        )
        return
      }

      const elementEdit = elementEditRef.current
      if (elementEdit && isTypedCharacter && !isEditing) {
        event.preventDefault()
        const editElement = elements.find((element) => element.id === elementEdit.elementId)
        const currentValue =
          editElement && (editElement.kind === 'variable' || editElement.kind === 'node')
            ? editElement.value
            : ''
        const value = elementEdit.hasTyped ? currentValue + event.key : event.key
        elementEdit.hasTyped = true
        setElements((current) =>
          current.map((element) => {
            if (
              element.id !== elementEdit.elementId ||
              (element.kind !== 'variable' && element.kind !== 'node')
            ) {
              return element
            }
            return { ...element, value }
          }),
        )
        return
      }
      if (elementEdit && event.key === 'Backspace' && !isEditing) {
        event.preventDefault()
        const editElement = elements.find((element) => element.id === elementEdit.elementId)
        const currentValue =
          editElement && (editElement.kind === 'variable' || editElement.kind === 'node')
            ? editElement.value
            : ''
        const value = elementEdit.hasTyped ? currentValue.slice(0, -1) : ''
        elementEdit.hasTyped = true
        setElements((current) =>
          current.map((element) => {
            if (
              element.id !== elementEdit.elementId ||
              (element.kind !== 'variable' && element.kind !== 'node')
            ) {
              return element
            }
            return { ...element, value }
          }),
        )
        return
      }
      const deleteTargetId =
        isArrayCell && cellEdit ? cellEdit.arrayId : selectedId || [...selectedIds][0] || 0
      if (
        (event.key === 'Delete' ||
          (!cellEdit && !elementEdit && !isEditing && event.key === 'Backspace')) &&
        deleteTargetId
      ) {
        if (selectedCellIds.size > 0) {
          event.preventDefault()
          deleteSelection()
          return
        }
        const deleteTarget = elements.find((element) => element.id === deleteTargetId)
        if (isArrayCell && cellEdit && deleteTarget?.kind === 'map') {
          event.preventDefault()
          const deleteValues = getCollectionValues(deleteTarget)
          const deleteElementIds = getCollectionElementIds(deleteTarget)
          const pairStart = Math.floor(cellEdit.index / 2) * 2
          const removedCellIds = deleteElementIds.slice(pairStart, pairStart + 2)
          const remainingCellCount = deleteValues.length - removedCellIds.length
          if (remainingCellCount < 2) {
            const values = [...deleteValues]
            for (let index = pairStart; index < pairStart + 2; index += 1) {
              if (index < values.length) values[index] = ''
            }
            setElements((current) =>
              current.map((element) =>
                isSketchCollection(element) && element.id === deleteTargetId
                  ? withCollectionCells(element, values, getCollectionElementIds(element))
                  : element,
              ),
            )
            cellEditRef.current = {
              ...cellEdit,
              index: pairStart,
              hasTyped: false,
            }
            setSelectedCell(pairStart)
          } else {
            const nextIndex = Math.max(0, pairStart - 2)
            setElements((current) =>
              current
                .filter(
                  (element) =>
                    !(element.kind === 'iterator' && removedCellIds.includes(element.hostId)),
                )
                .map((element) => {
                  if (!isSketchCollection(element) || element.id !== deleteTargetId) return element
                  const values = [...getCollectionValues(element)]
                  const elementIds = [...getCollectionElementIds(element)]
                  values.splice(pairStart, 2)
                  elementIds.splice(pairStart, 2)
                  return withCollectionCells(element, values, elementIds)
                }),
            )
            cellEditRef.current = {
              arrayId: deleteTargetId,
              index: nextIndex,
              hasTyped: false,
            }
            setSelectedCell(nextIndex)
          }
          return
        }
        if (
          selectedIds.size <= 1 &&
          deleteTarget &&
          isSketchCollection(deleteTarget) &&
          getCollectionValues(deleteTarget).length <= 1
        ) {
          event.preventDefault()
          setElements((current) =>
            current.map((element) =>
              isSketchCollection(element) && element.id === deleteTargetId
                ? withCollectionCells(element, [''], getCollectionElementIds(element).slice(0, 1))
                : element,
            ),
          )
          cellEditRef.current = { arrayId: deleteTargetId, index: 0, hasTyped: false }
          setSelectedCell(0)
          return
        }
        event.preventDefault()
        deleteElement(deleteTargetId)
      }
    }

    /** Resets typing when clicking elsewhere without erasing a new canvas selection. */
    const handleMouseDown = (event: MouseEvent) => {
      resetCellTyping()
      if (cellEditRef.current?.insertBefore) {
        cellEditRef.current = { ...cellEditRef.current, insertBefore: false }
        setIsInsertBefore(false)
      }
      const target = event.target
      const canvasTarget = target instanceof Element && target.closest('.canvas')
      const arrayCellTarget = target instanceof Element && target.closest('.array-cell-input')
      if (canvasTarget && !arrayCellTarget) {
        confirmCellEditRef.current(cellEditRef.current)
        cellEditRef.current = null
      }
      if (!canvasTarget) elementEditRef.current = null
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [
    deleteElement,
    deleteSelection,
    copySelection,
    cellEditRef,
    confirmCellEditRef,
    elementEditRef,
    elements,
    isLeetCodeModalOpen,
    nextId,
    resetCellTyping,
    selectedCellIds,
    selectedId,
    selectedIds,
    setIsInsertBefore,
    setSelectedCell,
    setSelectedCellIds,
    setElements,
    setNextId,
    pasteClipboard,
  ])
}
