import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CellEditState, SketchArray, SketchElement } from '../types/sketch'
import type { CellEditConfirmation } from './useSketchSelection'

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
  setAppendCellsArrayId: Dispatch<SetStateAction<number | null>>
  resetCellTyping: () => void
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
  setAppendCellsArrayId,
  resetCellTyping,
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

      if (cellEdit && isCanvasCellEdit && (event.key === 'Backspace' || event.key === 'Delete')) {
        cellEdit.appendMode = false
        cellEdit.replaceOnly = true
        setAppendCellsArrayId(null)
      }

      if (
        cellEdit &&
        isCanvasCellEdit &&
        selectedIds.size === 1 &&
        selectedIds.has(cellEdit.arrayId) &&
        event.key.startsWith('Arrow')
      ) {
        const array = elements.find(
          (element): element is SketchArray =>
            element.kind === 'array' && element.id === cellEdit.arrayId,
        )
        if (!array) return

        const index = cellEdit.index
        let nextIndex = index
        if (array.layout === 'matrix') {
          const columns = Math.max(1, array.columns ?? 1)
          const row = Math.floor(index / columns)
          const column = index % columns
          if (event.key === 'ArrowLeft' && column > 0) nextIndex = index - 1
          if (
            event.key === 'ArrowRight' &&
            column + 1 < Math.min(columns, array.values.length - row * columns)
          ) {
            nextIndex = index + 1
          }
          if (event.key === 'ArrowUp' && row > 0) nextIndex = index - columns
          if (event.key === 'ArrowDown' && index + columns < array.values.length) {
            nextIndex = index + columns
          }
        } else if (array.layout === 'map') {
          const column = index % 2
          if (event.key === 'ArrowLeft' && column > 0) nextIndex = index - 1
          if (event.key === 'ArrowRight' && column === 0 && index + 1 < array.values.length) {
            nextIndex = index + 1
          }
          if (event.key === 'ArrowUp' && index >= 2) nextIndex = index - 2
          if (event.key === 'ArrowDown' && index + 2 < array.values.length) {
            nextIndex = index + 2
          }
        } else if (array.layout === 'vertical') {
          if (event.key === 'ArrowUp' && index > 0) nextIndex = index - 1
          if (event.key === 'ArrowDown' && index + 1 < array.values.length) nextIndex = index + 1
        } else {
          if (event.key === 'ArrowLeft' && index > 0) nextIndex = index - 1
          if (event.key === 'ArrowRight' && index + 1 < array.values.length) {
            nextIndex = index + 1
          }
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
          }
          setAppendCellsArrayId(null)
          setSelectedCell(selectedIndex)
          setSelectedCellIds(new Set([array.element_ids[selectedIndex]]))
        }
        return
      }

      if (
        cellEdit &&
        isCanvasCellEdit &&
        cellEdit.hasTyped &&
        isTypedCharacter &&
        event.key !== ',' &&
        cellEdit.appendMode &&
        !cellEdit.replaceOnly &&
        !/^[0-9.-]$/.test(event.key)
      ) {
        const array = elements.find(
          (element): element is SketchArray =>
            element.kind === 'array' && element.id === cellEdit.arrayId,
        )
        if (
          array &&
          (array.layout === undefined || array.layout === 'horizontal') &&
          cellEdit.index === array.values.length - 1
        ) {
          event.preventDefault()
          const newIndex = array.values.length
          const newCellId = nextId
          setElements((current) =>
            current.map((element) => {
              if (element.kind !== 'array' || element.id !== cellEdit.arrayId) return element
              return {
                ...element,
                values: [...element.values, event.key],
                element_ids: [...element.element_ids, newCellId],
              }
            }),
          )
          setNextId((current) => current + 1)
          cellEditRef.current = {
            arrayId: cellEdit.arrayId,
            index: newIndex,
            hasTyped: true,
            appendMode: true,
          }
          setSelectedCell(newIndex)
          setSelectedCellIds(new Set([newCellId]))
          return
        }
      }

      if (cellEdit && isCanvasCellEdit && (isTypedCharacter || event.key === 'Backspace')) {
        event.preventDefault()
        if (isTypedCharacter && !/^[0-9.-]$/.test(event.key)) {
          const array = elements.find(
            (element): element is SketchArray =>
              element.kind === 'array' && element.id === cellEdit.arrayId,
          )
          if (!array) {
            cellEditRef.current = null
            return
          }

          const nextIndex = cellEdit.index + 1
          const isAddingCell = event.key === ','
          const isHorizontalArray = array.layout === undefined || array.layout === 'horizontal'
          const isMap = array.layout === 'map'
          const confirmed = isAddingCell ? confirmCellEditRef.current(cellEdit) : null
          const activeIndex =
            confirmed?.arrayId === array.id ? confirmed.adjustedIndex : cellEdit.index
          const insertedIndex = isMap ? (Math.floor(activeIndex / 2) + 1) * 2 : activeIndex + 1
          const insertedCellCount = isMap ? 2 : 1
          if (isAddingCell) {
            setElements((current) =>
              current.map((element) => {
                if (element.kind !== 'array' || element.id !== cellEdit.arrayId) return element
                const values = [...element.values]
                const elementIds = [...element.element_ids]
                values.splice(insertedIndex, 0, ...Array(insertedCellCount).fill(''))
                elementIds.splice(
                  insertedIndex,
                  0,
                  ...Array.from({ length: insertedCellCount }, (_, index) => nextId + index),
                )
                return { ...element, values, element_ids: elementIds }
              }),
            )
            setNextId((current) => current + insertedCellCount)
          } else {
            const currentValue = array.values[cellEdit.index] ?? ''
            const nextValue = isHorizontalArray
              ? event.key
              : cellEdit.hasTyped
                ? currentValue + event.key
                : event.key
            setElements((current) =>
              current.map((element) => {
                if (element.kind !== 'array' || element.id !== cellEdit.arrayId) return element
                const values = [...element.values]
                values[cellEdit.index] = nextValue
                return { ...element, values }
              }),
            )
          }

          const selectedIndex = isAddingCell
            ? insertedIndex
            : isHorizontalArray
              ? Math.min(nextIndex, array.values.length - 1)
              : (cellEditRef.current?.index ?? cellEdit.index)
          setAppendCellsArrayId(
            !isAddingCell &&
              isHorizontalArray &&
              !cellEdit.replaceOnly &&
              !/^[0-9.-]$/.test(event.key) &&
              cellEdit.index === array.values.length - 1
              ? array.id
              : null,
          )
          cellEditRef.current = {
            arrayId: cellEdit.arrayId,
            index: selectedIndex,
            hasTyped: !isAddingCell && selectedIndex === cellEdit.index,
            replaceOnly: isAddingCell ? false : cellEdit.replaceOnly,
            appendMode:
              !isAddingCell &&
              isHorizontalArray &&
              !cellEdit.replaceOnly &&
              !/^[0-9.-]$/.test(event.key) &&
              cellEdit.index === array.values.length - 1,
          }
          setSelectedCell(selectedIndex)
          const selectedCellId = isAddingCell ? nextId : array.element_ids[selectedIndex]
          setSelectedCellIds(new Set([selectedCellId]))
          return
        }

        const currentValue =
          elements.find(
            (element): element is SketchArray =>
              element.kind === 'array' && element.id === cellEdit.arrayId,
          )?.values[cellEdit.index] ?? ''
        if (event.key === 'Backspace' && currentValue === '') {
          const array = elements.find(
            (element): element is SketchArray =>
              element.kind === 'array' && element.id === cellEdit.arrayId,
          )
          const removedCellId = array?.element_ids[cellEdit.index]
          if (array && removedCellId !== undefined) {
            if (selectedCellIds.size > 0) {
              event.preventDefault()
              deleteSelection()
              return
            }
            const isMap = array.layout === 'map'
            const pairStart = isMap ? Math.floor(cellEdit.index / 2) * 2 : cellEdit.index
            const removeCount = isMap ? 2 : 1
            const removedCellIds = array.element_ids.slice(pairStart, pairStart + removeCount)
            const remainingCellCount = array.values.length - removedCellIds.length
            if (remainingCellCount < (isMap ? 2 : 1)) {
              const values = [...array.values]
              for (let index = pairStart; index < pairStart + removeCount; index += 1) {
                if (index < values.length) values[index] = ''
              }
              cellEditRef.current = {
                ...cellEdit,
                index: pairStart,
                hasTyped: false,
                replaceOnly: true,
                appendMode: false,
              }
              setAppendCellsArrayId(null)
              setElements((current) =>
                current.map((element) =>
                  element.kind === 'array' && element.id === cellEdit.arrayId
                    ? { ...element, values }
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
                  if (element.kind !== 'array' || element.id !== cellEdit.arrayId) return element
                  const values = [...element.values]
                  const elementIds = [...element.element_ids]
                  values.splice(pairStart, removeCount)
                  elementIds.splice(pairStart, removeCount)
                  return { ...element, values, element_ids: elementIds }
                }),
            )
            cellEditRef.current = {
              arrayId: cellEdit.arrayId,
              index: nextIndex,
              hasTyped: false,
              replaceOnly: true,
              appendMode: false,
            }
            setAppendCellsArrayId(null)
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
        if (isTypedCharacter && !cellEdit.hasTyped) {
          const array = elements.find(
            (element): element is SketchArray =>
              element.kind === 'array' && element.id === cellEdit.arrayId,
          )
          const startsAppendMode =
            isTypedCharacter &&
            event.key !== ',' &&
            !/^[0-9.-]$/.test(event.key) &&
            !cellEdit.replaceOnly &&
            array !== undefined &&
            cellEdit.index === array.values.length - 1
          cellEdit.appendMode = startsAppendMode
          setAppendCellsArrayId(startsAppendMode ? (array?.id ?? null) : null)
        } else if (isTypedCharacter && /^[0-9.-]$/.test(event.key)) {
          cellEdit.appendMode = false
          setAppendCellsArrayId(null)
        }
        cellEdit.hasTyped = true
        setElements((current) =>
          current.map((element) => {
            if (
              element.kind !== 'array' ||
              element.id !== cellEdit.arrayId ||
              cellEdit.index >= element.values.length
            ) {
              return element
            }
            const values = [...element.values]
            values[cellEdit.index] = nextValue
            return { ...element, values }
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
      const deleteTargetId = isArrayCell && cellEdit ? cellEdit.arrayId : selectedId
      if (event.key === 'Delete' && deleteTargetId) {
        if (selectedCellIds.size > 0) {
          event.preventDefault()
          deleteSelection()
          return
        }
        const deleteTarget = elements.find((element) => element.id === deleteTargetId)
        if (
          isArrayCell &&
          cellEdit &&
          deleteTarget?.kind === 'array' &&
          deleteTarget.layout === 'map'
        ) {
          event.preventDefault()
          const pairStart = Math.floor(cellEdit.index / 2) * 2
          const removedCellIds = deleteTarget.element_ids.slice(pairStart, pairStart + 2)
          const remainingCellCount = deleteTarget.values.length - removedCellIds.length
          if (remainingCellCount < 2) {
            const values = [...deleteTarget.values]
            for (let index = pairStart; index < pairStart + 2; index += 1) {
              if (index < values.length) values[index] = ''
            }
            setElements((current) =>
              current.map((element) =>
                element.kind === 'array' && element.id === deleteTargetId
                  ? { ...element, values }
                  : element,
              ),
            )
            cellEditRef.current = {
              ...cellEdit,
              index: pairStart,
              hasTyped: false,
              replaceOnly: true,
              appendMode: false,
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
                  if (element.kind !== 'array' || element.id !== deleteTargetId) return element
                  const values = [...element.values]
                  const elementIds = [...element.element_ids]
                  values.splice(pairStart, 2)
                  elementIds.splice(pairStart, 2)
                  return { ...element, values, element_ids: elementIds }
                }),
            )
            cellEditRef.current = {
              arrayId: deleteTargetId,
              index: nextIndex,
              hasTyped: false,
              replaceOnly: true,
              appendMode: false,
            }
            setSelectedCell(nextIndex)
          }
          setAppendCellsArrayId(null)
          return
        }
        if (deleteTarget?.kind === 'array' && deleteTarget.values.length <= 1) {
          event.preventDefault()
          setElements((current) =>
            current.map((element) =>
              element.kind === 'array' && element.id === deleteTargetId
                ? { ...element, values: [''] }
                : element,
            ),
          )
          cellEditRef.current = {
            arrayId: deleteTargetId,
            index: 0,
            hasTyped: false,
            replaceOnly: true,
            appendMode: false,
          }
          setSelectedCell(0)
          setAppendCellsArrayId(null)
          return
        }
        deleteElement(deleteTargetId)
      }
    }

    /** Resets typing when clicking elsewhere without erasing a new canvas selection. */
    const handleMouseDown = (event: MouseEvent) => {
      resetCellTyping()
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
    setAppendCellsArrayId,
    setSelectedCell,
    setSelectedCellIds,
    setElements,
    setNextId,
    pasteClipboard,
  ])
}
