import React, { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { Canvas } from './components/Canvas/Canvas'
import { Header } from './components/Header/Header'
import { LeetCodeModal } from './components/LeetCodeModal/LeetCodeModal'
import { Sidebar } from './components/Sidebar/Sidebar'
import { CELL_SIZE, initialElements, iteratorColors } from './constants/sketch'
import { buildCanvasElementsFromTestCases, type ParsedTestCase } from './services/leetcode'
import type {
  CellEditState,
  DragState,
  IteratorDragState,
  MarqueeDrag,
  PointerDraft,
  RelationshipDrag,
  SelectionBox,
  SketchArray,
  SketchElement,
  SketchIterator,
  SketchNode,
} from './types/sketch'
import { elementBounds, hostBounds, hostIdFromPoint } from './utils/canvas'

type CellEditConfirmation = {
  arrayId: number
  start: number
  count: number
  adjustedIndex: number
}

function App() {
  const [elements, setElements] = useState<SketchElement[]>(initialElements)
  const [selectedId, setSelectedId] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set([1]))
  const [selectedCellIds, setSelectedCellIds] = useState<Set<number>>(new Set())
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [nextId, setNextId] = useState(15)
  const [isLeetCodeModalOpen, setIsLeetCodeModalOpen] = useState(false)
  const [problemStatus, setProblemStatus] = useState('')
  const [appendCellsArrayId, setAppendCellsArrayId] = useState<number | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const pointerRef = useRef<PointerDraft | null>(null)
  const relationshipRef = useRef<RelationshipDrag | null>(null)
  const iteratorDragRef = useRef<{ id: number; startX: number; startY: number } | null>(null)
  const iteratorClickRef = useRef<{ id: number; time: number } | null>(null)
  const cellEditRef = useRef<CellEditState | null>(null)
  const confirmCellEditRef = useRef<
    (cellEdit: CellEditState | null) => CellEditConfirmation | null
  >(() => null)
  const elementEditRef = useRef<{ elementId: number; hasTyped: boolean } | null>(null)
  const marqueeRef = useRef<MarqueeDrag | null>(null)

  const [pointerDraft, setPointerDraft] = useState<PointerDraft | null>(null)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)
  const [iteratorDrag, setIteratorDrag] = useState<IteratorDragState | null>(null)

  const selected = elements.find((element) => element.id === selectedId)

  useEffect(() => {
    const cellEdit = cellEditRef.current
    const activeElement = document.activeElement
    if (
      !cellEdit ||
      (activeElement !== document.body &&
        !(
          activeElement instanceof HTMLElement &&
          activeElement.classList.contains('array-cell-input')
        ))
    ) {
      return
    }

    const arrayElement = canvasRef.current?.querySelector<HTMLElement>(
      `.canvas-element[data-host-id="${cellEdit.arrayId}"]`,
    )
    const cells = arrayElement?.querySelectorAll<HTMLInputElement>('.array-cell-input')
    cells?.[cellEdit.index]?.focus()
  }, [elements, selectedCell])

  /**
   * Selects a cell and initializes the typing state used to replace its value
   * on the first key press.
   * @param arrayId ID of the array that owns the cell.
   * @param index Zero-based index of the selected cell.
   */
  const selectCell = (arrayId: number, index: number) => {
    const currentEdit = cellEditRef.current
    let selectedIndex = index
    if (!currentEdit || currentEdit.arrayId !== arrayId || currentEdit.index !== index) {
      const confirmed = confirmCellEditRef.current(cellEditRef.current)
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
  }

  /** Lets the next typed character replace the selected cell's current value. */
  const resetCellTyping = () => {
    if (cellEditRef.current) cellEditRef.current.hasTyped = false
    setAppendCellsArrayId(null)
  }

  /**
   * Enforces set-value and map-key uniqueness when leaving an edited cell.
   * @returns The removed duplicate range so a newly selected cell can retain its position.
   */
  useEffect(() => {
    confirmCellEditRef.current = (cellEdit) => {
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
    }
  }, [elements])

  /**
   * Selects one element, optionally preserving the other selected IDs.
   * @param id ID of the element to make primary.
   * @param additive When true, retain the existing selection set.
   */
  const selectOne = (id: number, additive = false) => {
    if (cellEditRef.current && (id !== selectedId || !selectedIds.has(id))) {
      confirmCellEditRef.current(cellEditRef.current)
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
  }

  /**
   * Deletes the requested element, or the full current selection when it
   * includes that element. Also removes array cells, hosted iterators, and
   * node pointers that refer to deleted IDs.
   * @param id ID of the element whose deletion was requested.
   */
  const deleteElement = useCallback((id: number) => {
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
  }, [])

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
  }, [elements, selectedCellIds, selectedIds])

  // Install global keyboard and mouse handlers for canvas editing, and remove
  // them whenever this effect is re-run or the component is unmounted.
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
    elements,
    isLeetCodeModalOpen,
    nextId,
    selectedCellIds,
    selectedId,
    selectedIds,
  ])

  /**
   * Applies property edits to the selected element. Array value edits also
   * keep cell IDs in sync and remove iterators hosted by cells that are removed.
   * @param patch Partial set of element properties supplied by the sidebar.
   */
  const updateSelected = (patch: Partial<SketchElement>) => {
    if (selected?.kind === 'array' && 'values' in patch && Array.isArray(patch.values)) {
      const values = patch.values as string[]
      const addedCellCount = Math.max(0, values.length - selected.element_ids.length)
      const removedCellIds = new Set(selected.element_ids.slice(values.length))
      setElements(
        (current) =>
          current
            .filter(
              (element) => !(element.kind === 'iterator' && removedCellIds.has(element.hostId)),
            )
            .map((element) => {
              if (element.id !== selectedId || element.kind !== 'array') return element
              const elementIds = values.map(
                (_, index) => element.element_ids[index] ?? nextId + index,
              )
              return { ...element, ...patch, values, element_ids: elementIds }
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

  /**
   * Creates a new iterator record using the next available color.
   * @param id Unique ID assigned to the iterator.
   * @param hostId ID of the node or array cell the iterator points to.
   * @param mode Side of the host where the iterator is displayed.
   * @param colorIndex Index used to cycle through the iterator color palette.
   */
  const createIterator = (
    id: number,
    hostId: number,
    mode: 'top' | 'bottom' | 'left' | 'right',
    colorIndex: number,
  ): SketchIterator => ({
    id,
    kind: 'iterator',
    hostId,
    color: iteratorColors[colorIndex % iteratorColors.length],
    mode,
  })

  /**
   * Adds an iterator to a host, resolving array hosts to the selected cell (or
   * the first cell) and choosing a display side compatible with its layout.
   * @param hostId ID of the requested node, array, or array cell.
   * @param preferredMode Optional top/bottom preference for node hosts.
   */
  const addIterator = (hostId: number, preferredMode?: 'top' | 'bottom' | 'left' | 'right') => {
    let targetHostId = hostId
    const hostElement = elements.find((element) => element.id === hostId)
    if (hostElement?.kind === 'array') {
      if (selectedCell !== null && hostElement.element_ids[selectedCell] !== undefined) {
        const cellIndex =
          hostElement.layout === 'map' && selectedCell % 2 !== 0 ? selectedCell - 1 : selectedCell
        targetHostId = hostElement.element_ids[cellIndex]
      } else if (hostElement.element_ids.length > 0) {
        targetHostId = hostElement.element_ids[0]
      }
    }
    if (!hostBounds(elements, targetHostId)) return
    const id = nextId
    const count = elements.filter((element) => element.kind === 'iterator').length
    const hostArray = elements.find(
      (element): element is SketchArray =>
        element.kind === 'array' && element.element_ids.includes(targetHostId),
    )
    let mode: 'top' | 'bottom' | 'left' | 'right' = hostArray ? 'top' : 'bottom'
    if (hostArray?.layout === 'vertical' || hostArray?.layout === 'map') {
      mode = 'left'
    } else if (!hostArray && (preferredMode === 'top' || preferredMode === 'bottom')) {
      mode = preferredMode
    }
    const iterator = createIterator(id, targetHostId, mode, count)
    setElements((current) => [...current, iterator])
    setNextId((current) => current + 1)
    selectOne(id)
  }

  /**
   * Creates an iterator when the user double-clicks a node or array cell.
   * Matrix cells receive both a column iterator and a row iterator.
   * @param event Mouse event containing the clicked canvas coordinates and DOM target.
   */
  const handleHostDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault()
    window.getSelection()?.removeAllRanges()
    const pointTarget = document.elementFromPoint(
      event.clientX,
      event.clientY,
    ) as HTMLElement | null
    const currentTarget = event.currentTarget as HTMLElement | null
    const eventTarget = event.target as HTMLElement | null

    const cellTarget =
      currentTarget?.closest<HTMLElement>('[data-host-cell-id]') ||
      eventTarget?.closest<HTMLElement>('[data-host-cell-id]') ||
      pointTarget?.closest<HTMLElement>('[data-host-cell-id]')

    const hostTarget =
      cellTarget ||
      currentTarget?.closest<HTMLElement>('[data-host-id]') ||
      eventTarget?.closest<HTMLElement>('[data-host-id]') ||
      pointTarget?.closest<HTMLElement>('[data-host-id]')

    const hostIdStr = cellTarget?.dataset.hostCellId || hostTarget?.dataset.hostId
    if (!hostIdStr) return

    let hostId = Number(hostIdStr)
    const matrix = cellTarget
      ? elements.find(
          (element): element is SketchArray =>
            element.kind === 'array' &&
            element.layout === 'matrix' &&
            element.element_ids.includes(hostId),
        )
      : undefined
    if (matrix) {
      const index = matrix.element_ids.indexOf(hostId)
      const columns = Math.max(1, matrix.columns ?? 1)
      const row = Math.floor(index / columns)
      const column = index % columns
      const iteratorCount = elements.filter((element) => element.kind === 'iterator').length
      const topIterator = createIterator(nextId, matrix.element_ids[column], 'top', iteratorCount)
      const leftIterator = createIterator(
        nextId + 1,
        matrix.element_ids[row * columns],
        'left',
        iteratorCount + 1,
      )
      event.preventDefault()
      event.stopPropagation()
      setElements((current) => [...current, topIterator, leftIterator])
      setNextId((current) => current + 2)
      selectOne(topIterator.id)
      return
    }

    const hostElement = elements.find((el) => el.id === hostId)
    if (hostElement?.kind === 'array') {
      if (selectedCell !== null && hostElement.element_ids[selectedCell] !== undefined) {
        const cellIndex =
          hostElement.layout === 'map' && selectedCell % 2 !== 0 ? selectedCell - 1 : selectedCell
        hostId = hostElement.element_ids[cellIndex]
      } else if (hostElement.element_ids.length > 0) {
        hostId = hostElement.element_ids[0]
      }
    }

    let preferredMode: 'top' | 'bottom' | 'left' | 'right' | undefined
    if (
      hostElement?.kind === 'array' &&
      (hostElement.layout === 'vertical' || hostElement.layout === 'map')
    ) {
      preferredMode = 'left'
    } else {
      const bounds = hostBounds(elements, hostId)
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      if (bounds && canvasRect) {
        const hostScreenY = canvasRect.top + bounds.y
        const centerY = hostScreenY + bounds.height / 2
        preferredMode = event.clientY < centerY ? 'top' : 'bottom'
      }
    }

    event.stopPropagation()
    addIterator(hostId, preferredMode)
  }

  /**
   * Advances an iterator one linked node or collection cell in its current
   * direction. Does nothing when the host has no valid next item.
   * @param iterator Iterator whose host position should advance.
   */
  const advanceIterator = (iterator: SketchIterator) => {
    const host =
      elements.find((element) => element.id === iterator.hostId && element.kind === 'node') ||
      elements.find(
        (element) => element.kind === 'array' && element.element_ids.includes(iterator.hostId),
      )
    let nextHostId: number | null = null
    if (host?.kind === 'node' && host.pointer_ids.length === 1) nextHostId = host.pointer_ids[0]
    if (host?.kind === 'array') {
      const index = host.element_ids.indexOf(iterator.hostId)
      if (host.layout === 'matrix') {
        const columns = Math.max(1, host.columns ?? 1)
        const column = index % columns
        const step = iterator.mode === 'left' ? columns : 1
        if (
          index >= 0 &&
          (iterator.mode === 'left' ? index + step < host.element_ids.length : column + 1 < columns)
        ) {
          nextHostId = host.element_ids[index + step]
        }
      } else {
        const step = host.layout === 'map' ? 2 : 1
        if (index >= 0 && index + step < host.element_ids.length) {
          nextHostId = host.element_ids[index + step]
        }
      }
    }
    if (nextHostId === null) return
    setElements((current) =>
      current.map((element) =>
        element.kind === 'iterator' && element.id === iterator.id
          ? { ...element, hostId: nextHostId! }
          : element,
      ),
    )
  }

  /**
   * Starts dragging an iterator, advances it on right-click, and removes it on
   * a rapid second left-click.
   * @param event Pointer event on the iterator; its button determines the action.
   * @param iterator Iterator being acted on.
   */
  const startIteratorDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    iterator: SketchIterator,
  ) => {
    if (event.button === 2) {
      event.preventDefault()
      event.stopPropagation()
      advanceIterator(iterator)
      return
    }
    if (event.button !== 0) return
    const now = Date.now()
    const previousClick = iteratorClickRef.current
    if (previousClick?.id === iterator.id && now - previousClick.time < 500) {
      iteratorClickRef.current = null
      deleteElement(iterator.id)
    } else {
      iteratorClickRef.current = { id: iterator.id, time: now }
    }
    const bounds = canvasRef.current?.getBoundingClientRect()
    const relX = bounds ? event.clientX - bounds.left - 6 : event.clientX
    const relY = bounds ? event.clientY - bounds.top - 4 : event.clientY
    iteratorDragRef.current = { id: iterator.id, startX: event.clientX, startY: event.clientY }
    setIteratorDrag({ id: iterator.id, x: relX, y: relY })
    selectOne(iterator.id)
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  /**
   * Updates the selection rectangle and the set of non-iterator elements it
   * intersects while the user drags on empty canvas space.
   * @param event Pointer event providing the current cursor position.
   */
  const updateMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    const marquee = marqueeRef.current
    if (!bounds || !marquee) return
    const currentX = event.clientX - bounds.left
    const currentY = event.clientY - bounds.top
    const x = Math.min(marquee.startX, currentX)
    const y = Math.min(marquee.startY, currentY)
    const width = Math.abs(currentX - marquee.startX)
    const height = Math.abs(currentY - marquee.startY)
    setSelectionBox({ x, y, width, height })
    const intersects = (item: { x: number; y: number; width: number; height: number }) =>
      item.x < x + width &&
      item.x + item.width > x &&
      item.y < y + height &&
      item.y + item.height > y
    const selectedObjectIds: number[] = []
    const selectedCellIdsInBox = new Set<number>()
    const previouslyWholeSelectedArrayIds = new Set(
      elements
        .filter(
          (element): element is SketchArray =>
            element.kind === 'array' &&
            selectedIds.has(element.id) &&
            !element.element_ids.some((cellId) => selectedCellIds.has(cellId)),
        )
        .map((array) => array.id),
    )
    elements.forEach((element) => {
      if (element.kind === 'iterator') return
      const bounds = elementBounds(element)
      if (!intersects(bounds)) return
      if (element.kind !== 'array') {
        selectedObjectIds.push(element.id)
        return
      }

      const fullyContained =
        x <= bounds.x &&
        y <= bounds.y &&
        x + width >= bounds.x + bounds.width &&
        y + height >= bounds.y + bounds.height
      if (fullyContained) {
        selectedObjectIds.push(element.id)
        return
      }

      const selectedIndexes: number[] = []
      element.values.forEach((_, index) => {
        const columns = Math.max(1, element.columns ?? 1)
        const column =
          element.layout === 'vertical'
            ? 0
            : element.layout === 'map'
              ? index % 2
              : element.layout === 'matrix'
                ? index % columns
                : index
        const row =
          element.layout === 'vertical'
            ? index
            : element.layout === 'map'
              ? Math.floor(index / 2)
              : element.layout === 'matrix'
                ? Math.floor(index / columns)
                : 0
        if (
          intersects({
            x: element.position.x + column * CELL_SIZE,
            y: element.position.y + row * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
          })
        ) {
          selectedIndexes.push(index)
        }
      })
      if (element.layout === 'map') {
        for (const index of [...selectedIndexes]) {
          const pairedIndex = index % 2 === 0 ? index + 1 : index - 1
          if (pairedIndex < element.element_ids.length) selectedIndexes.push(pairedIndex)
        }
      }
      if (selectedIndexes.length > 0) {
        selectedObjectIds.push(element.id)
        if (!marquee.additive || !previouslyWholeSelectedArrayIds.has(element.id)) {
          selectedIndexes.forEach((index) => selectedCellIdsInBox.add(element.element_ids[index]))
        }
      }
    })
    setSelectedIds((currentSelection) => {
      const next = marquee.additive ? new Set(currentSelection) : new Set<number>()
      selectedObjectIds.forEach((id) => next.add(id))
      return next
    })
    setSelectedCellIds((currentSelection) => {
      const next = marquee.additive ? new Set(currentSelection) : new Set<number>()
      elements.forEach((element) => {
        if (element.kind !== 'array' || !selectedObjectIds.includes(element.id)) return
        const item = elementBounds(element)
        if (
          x <= item.x &&
          y <= item.y &&
          x + width >= item.x + item.width &&
          y + height >= item.y + item.height
        ) {
          element.element_ids.forEach((cellId) => next.delete(cellId))
        }
      })
      selectedCellIdsInBox.forEach((cellId) => next.add(cellId))
      return next
    })
    if (selectedObjectIds.length > 0) setSelectedId(selectedObjectIds[0])
    setSelectedCell(null)
  }

  // Element-creation helpers append a new sketch object and select it. The
  // collection helpers below create complete preset data structures at once.
  /**
   * Adds a variable or pointer node at a staggered canvas position.
   * @param kind Determines whether the new element is a variable or node.
   */
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

  /**
   * Adds a horizontal array initialized with caller-provided values and label.
   * @param values Initial value for each array cell.
   * @param label Display label for the array.
   */
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
        layout: 'horizontal',
      },
    ])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
  }

  /** Adds the example vertical set and selects it. */
  const addSet = () => {
    const id = nextId
    const values = ['2', '7', '11', '15']
    const elementIds = values.map((_, index) => id + index + 1)
    setElements((current) => [
      ...current,
      {
        id,
        kind: 'array',
        label: 'set',
        element_ids: elementIds,
        values,
        position: { x: 180, y: 120 },
        layout: 'vertical',
      },
    ])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
  }

  /** Adds the example key/value map and selects it. */
  const addMap = () => {
    const id = nextId
    const values = ['name', 'Ada', 'role', 'coder', 'level', '42']
    const elementIds = values.map((_, index) => id + index + 1)
    setElements((current) => [
      ...current,
      {
        id,
        kind: 'array',
        label: 'map',
        element_ids: elementIds,
        values,
        position: { x: 180, y: 120 },
        layout: 'map',
      },
    ])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
  }

  /** Adds a three-node linked list and a head iterator pointing to its first node. */
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

  /** Adds a seven-node binary tree with child pointers and selects its root. */
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

  /** Adds a 3-by-3 matrix whose cells contain the values 1 through 9. */
  const addMatrix = () => {
    const id = nextId
    const values = Array.from({ length: 9 }, (_, index) => String(index + 1))
    setElements((current) => [
      ...current,
      {
        id,
        kind: 'array',
        label: 'matrix',
        element_ids: values.map((_, index) => id + index + 1),
        values,
        position: { x: 180, y: 120 },
        layout: 'matrix',
        columns: 3,
      },
    ])
    setNextId((current) => current + values.length + 1)
    selectOne(id)
  }

  /** Opens the test-case importer and clears any active array-cell edit. */
  const openLeetCodeModal = () => {
    confirmCellEditRef.current(cellEditRef.current)
    cellEditRef.current = null
    setSelectedCell(null)
    setIsLeetCodeModalOpen(true)
  }

  /** Closes the test-case importer. */
  const closeLeetCodeModal = () => {
    setIsLeetCodeModalOpen(false)
  }

  /**
   * Converts selected LeetCode test cases into canvas elements and appends them
   * below existing content.
   * @param selectedCases Parsed cases selected in the importer.
   * @param problemTitle Title used for the import status message.
   */
  const handleImportTestCases = (selectedCases: ParsedTestCase[], problemTitle: string) => {
    const maxY = elements.reduce((acc, el) => {
      if (el.kind === 'iterator') return acc
      return Math.max(acc, el.position.y + 110)
    }, 60)
    const startY = Math.max(100, maxY + 30)

    const result = buildCanvasElementsFromTestCases(selectedCases, nextId, startY)
    setElements((current) => [...current, ...result.elements])
    setNextId(result.nextId)

    const firstElement = result.elements[0]
    if (firstElement) {
      setSelectedIds(new Set(result.elements.map((e) => e.id)))
      setSelectedId(firstElement.id)
    }

    setProblemStatus(
      `${problemTitle} (${selectedCases.length} ${selectedCases.length === 1 ? 'case' : 'cases'} imported)`,
    )
  }

  /**
   * Begins a canvas gesture on an element. A left-button press starts moving
   * the selected group; Shift-dragging a node includes its reachable nodes;
   * right-button dragging a node starts or edits its pointer connection.
   * @param event React pointer event carrying the button, modifiers, cursor
   *   coordinates, and capture target for the gesture.
   * @param id ID of the element that received the pointer event.
   */
  const startDrag = (event: React.PointerEvent, id: number) => {
    window.getSelection()?.removeAllRanges()
    const element = elements.find((item) => item.id === id)
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!element || !bounds) return
    if (event.button === 0 && event.shiftKey) return
    const targetCell = event.target instanceof Element && event.target.closest('.array-cell-input')
    if (cellEditRef.current && !targetCell) {
      confirmCellEditRef.current(cellEditRef.current)
      cellEditRef.current = null
    }
    if (event.button === 0 && (element.kind === 'variable' || element.kind === 'node')) {
      elementEditRef.current = { elementId: id, hasTyped: false }
      cellEditRef.current = null
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    } else if (element.kind === 'array') {
      elementEditRef.current = null
    }
    const isArrayCellTarget =
      element.kind === 'array' &&
      event.target instanceof HTMLInputElement &&
      event.target.classList.contains('array-cell-input')
    let activeSelection = isArrayCellTarget
      ? selectedIds.has(id)
        ? new Set(selectedIds)
        : new Set([id])
      : selectedIds.has(id)
        ? new Set(selectedIds)
        : new Set([id])
    if (isArrayCellTarget) {
      if (!selectedIds.has(id)) setSelectedIds(activeSelection)
      setSelectedId(id)
    } else if (event.shiftKey && element.kind === 'node') {
      const visited = new Set<number>(activeSelection)
      const pendingIds = [id]
      while (pendingIds.length > 0) {
        const currentId = pendingIds.shift()!
        const currentElement = elements.find((item) => item.id === currentId)
        if (currentElement?.kind !== 'node') continue
        currentElement.pointer_ids.forEach((pointerId) => {
          if (visited.has(pointerId)) return
          visited.add(pointerId)
          pendingIds.push(pointerId)
        })
      }
      activeSelection = visited
      setSelectedIds(visited)
      setSelectedId(id)
    } else if (!selectedIds.has(id)) {
      selectOne(id)
      activeSelection = new Set([id])
    }
    if (element.kind === 'array' && !isArrayCellTarget) {
      setSelectedCell(null)
      setSelectedCellIds(new Set())
    }
    if (event.button === 2 && element.kind === 'node') {
      pointerRef.current = {
        sourceId: id,
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      }
      setPointerDraft(pointerRef.current)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (event.button !== 0) return
    const draggedIds = new Set<number>()
    activeSelection.forEach((selectedElementId) => {
      const selectedElement = elements.find((item) => item.id === selectedElementId)
      if (!selectedElement) return
      draggedIds.add(selectedElement.id)
      if (selectedElement.kind === 'array') {
        selectedElement.element_ids.forEach((elementId) => draggedIds.add(elementId))
      }
    })
    const primaryElement =
      elements.find(
        (item): item is Exclude<SketchElement, SketchIterator> =>
          item.id === id && item.kind !== 'iterator',
      ) ?? (element.kind === 'iterator' ? null : element)
    if (!primaryElement) return
    dragRef.current = {
      id,
      offsetX: event.clientX - bounds.left - primaryElement.position.x,
      offsetY: event.clientY - bounds.top - primaryElement.position.y,
      draggedIds,
      initialPositions: new Map(
        elements
          .filter(
            (item): item is Exclude<SketchElement, SketchIterator> =>
              item.kind !== 'iterator' && draggedIds.has(item.id),
          )
          .map((item) => [item.id, item.position]),
      ),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  /**
   * Updates the active iterator drag, pointer-connection draft, or element
   * group drag from the current pointer position.
   * @param event Pointer-move event over the canvas.
   */
  const moveElement = (event: React.PointerEvent<HTMLDivElement>) => {
    if (iteratorDragRef.current) {
      const bounds = canvasRef.current?.getBoundingClientRect()
      const relX = bounds ? event.clientX - bounds.left - 6 : event.clientX
      const relY = bounds ? event.clientY - bounds.top - 4 : event.clientY
      setIteratorDrag({ id: iteratorDragRef.current.id, x: relX, y: relY })
      return
    }
    if (pointerRef.current) {
      const bounds = canvasRef.current?.getBoundingClientRect()
      if (!bounds) return
      const draft = {
        ...pointerRef.current,
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      }
      pointerRef.current = draft
      setPointerDraft(draft)
      return
    }
    if (!dragRef.current) return
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return
    const { id, offsetX, offsetY, draggedIds, initialPositions } = dragRef.current
    const primaryPosition = initialPositions.get(id)
    if (!primaryPosition) return
    const x = Math.max(12, event.clientX - bounds.left - offsetX)
    const y = Math.max(24, event.clientY - bounds.top - offsetY)
    const deltaX = x - primaryPosition.x
    const deltaY = y - primaryPosition.y
    setElements((current) =>
      current.map((element) => {
        const initialPosition = initialPositions.get(element.id)
        if (!draggedIds.has(element.id) || !initialPosition || element.kind === 'iterator') {
          return element
        }
        return {
          ...element,
          position: {
            x: Math.max(12, initialPosition.x + deltaX),
            y: Math.max(24, initialPosition.y + deltaY),
          },
        }
      }),
    )
  }

  /**
   * Completes whichever canvas gesture is active: rehosts a dragged iterator,
   * removes a dragged relationship, ends marquee selection, or toggles a node
   * pointer connection at the pointer's release target.
   * @param event Pointer-up event containing the release position and target.
   */
  const finishPointer = (event: React.PointerEvent<HTMLDivElement | SVGLineElement>) => {
    if (iteratorDragRef.current) {
      const draggedIterator = iteratorDragRef.current
      const moved =
        Math.hypot(event.clientX - draggedIterator.startX, event.clientY - draggedIterator.startY) >
        4
      if (moved) {
        const hostId = hostIdFromPoint(elements, event.clientX, event.clientY)
        if (hostId !== null) {
          const hostArray = elements.find(
            (el): el is SketchArray => el.kind === 'array' && el.element_ids.includes(hostId),
          )
          let nextMode: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
          let nextHostId = hostId
          if (hostArray?.layout === 'vertical' || hostArray?.layout === 'map') {
            nextMode = 'left'
          } else if (hostArray?.layout === 'matrix') {
            const currentIterator = elements.find(
              (element): element is SketchIterator =>
                element.kind === 'iterator' && element.id === draggedIterator.id,
            )
            nextMode = currentIterator?.mode === 'left' ? 'left' : 'top'
            const index = hostArray.element_ids.indexOf(hostId)
            const columns = Math.max(1, hostArray.columns ?? 1)
            const row = Math.floor(index / columns)
            const column = index % columns
            nextHostId =
              nextMode === 'left'
                ? hostArray.element_ids[row * columns]
                : hostArray.element_ids[column]
          } else {
            const bounds = hostBounds(elements, hostId)
            const canvasRect = canvasRef.current?.getBoundingClientRect()
            if (bounds && canvasRect) {
              const hostScreenY = canvasRect.top + bounds.y
              const centerY = hostScreenY + bounds.height / 2
              nextMode = event.clientY < centerY ? 'top' : 'bottom'
            }
          }
          setElements((current) =>
            current.map((element) =>
              element.kind === 'iterator' && element.id === draggedIterator.id
                ? {
                    ...element,
                    hostId: nextHostId,
                    mode: nextMode,
                  }
                : element,
            ),
          )
        }
      }
      iteratorDragRef.current = null
      setIteratorDrag(null)
      return
    }
    if (relationshipRef.current) {
      const relationship = relationshipRef.current
      const moved =
        Math.hypot(event.clientX - relationship.startX, event.clientY - relationship.startY) > 4
      if (moved) {
        setElements((current) =>
          current.map((element) => {
            if (element.kind !== 'node' || element.id !== relationship.sourceId) return element
            const remainingPointers = element.pointer_ids.filter(
              (pointerId) => pointerId !== relationship.targetId,
            )
            return { ...element, pointer_ids: remainingPointers }
          }),
        )
      }
      relationshipRef.current = null
      return
    }
    if (marqueeRef.current) {
      marqueeRef.current = null
      setSelectionBox(null)
      return
    }
    if (!pointerRef.current) {
      dragRef.current = null
      return
    }
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-node-id]')
    const targetId = target ? Number(target.dataset.nodeId) : null
    const sourceId = pointerRef.current.sourceId
    setElements((current) =>
      current.map((element) => {
        if (element.id !== sourceId || element.kind !== 'node') return element
        if (!targetId || targetId === sourceId) {
          return { ...element, pointer_ids: [] }
        }
        if (element.pointer_ids.includes(targetId)) {
          return {
            ...element,
            pointer_ids: element.pointer_ids.filter((pointerId) => pointerId !== targetId),
          }
        }
        if (element.pointer_limit === 1) {
          return { ...element, pointer_ids: [targetId] }
        }
        if (element.pointer_limit === 2 && element.pointer_ids.length >= 2) return element
        return { ...element, pointer_ids: [...element.pointer_ids, targetId] }
      }),
    )
    pointerRef.current = null
    setPointerDraft(null)
  }

  /**
   * Starts a drag on an existing relationship line so releasing it elsewhere
   * can remove the corresponding node pointer.
   * @param event Pointer event on the SVG relationship line.
   * @param sourceId ID of the node that owns the pointer.
   * @param targetId ID of the node currently pointed to.
   */
  const handleRelationshipStart = (
    event: React.PointerEvent<SVGLineElement>,
    sourceId: number,
    targetId: number,
  ) => {
    if (event.button !== 0) return
    relationshipRef.current = {
      sourceId,
      targetId,
      startX: event.clientX,
      startY: event.clientY,
    }
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  /**
   * Starts marquee selection on the background, or with Shift over an element.
   * Shift preserves the current selection.
   * @param event Pointer-down event on the canvas container.
   */
  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    resetCellTyping()
    const startsMarquee =
      event.button === 0 && (event.target === event.currentTarget || event.shiftKey)
    if (startsMarquee) {
      confirmCellEditRef.current(cellEditRef.current)
      cellEditRef.current = null
      const bounds = canvasRef.current?.getBoundingClientRect()
      if (!bounds) return
      marqueeRef.current = {
        startX: event.clientX - bounds.left,
        startY: event.clientY - bounds.top,
        additive: event.shiftKey,
      }
      if (!event.shiftKey) {
        setSelectedIds(new Set())
        setSelectedCellIds(new Set())
        setSelectedId(0)
      }
      setSelectedCell(null)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  /**
   * Routes canvas pointer movement to marquee selection or the active drag.
   * @param event Pointer-move event on the canvas container.
   */
  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (marqueeRef.current) updateMarquee(event)
    else moveElement(event)
  }

  return (
    <main className="app-shell">
      <Header />
      <div className="workspace">
        <Sidebar
          selected={selected}
          onUpdateSelected={updateSelected}
          onDeleteElement={(id) =>
            selectedCellIds.size > 0 ? deleteSelection() : deleteElement(id)
          }
          onAddVariable={addVariable}
          onAddArray={addArray}
          onAddLinkedList={addLinkedList}
          onAddSet={addSet}
          onAddMap={addMap}
          onAddBinaryTree={addBinaryTree}
          onAddMatrix={addMatrix}
          onOpenLeetCodeModal={openLeetCodeModal}
          problemStatus={problemStatus}
        />
        <Canvas
          elements={elements}
          selectedIds={selectedIds}
          selectedCellIds={selectedCellIds}
          selectedId={selectedId}
          selectedCell={selectedCell}
          pointerDraft={pointerDraft}
          selectionBox={selectionBox}
          iteratorDrag={iteratorDrag}
          canvasRef={canvasRef}
          onCanvasPointerDown={handleCanvasPointerDown}
          onCanvasPointerMove={handleCanvasPointerMove}
          onCanvasPointerUp={finishPointer}
          onStartDrag={startDrag}
          onHostDoubleClick={handleHostDoubleClick}
          onSelectCell={selectCell}
          onResetCellTyping={resetCellTyping}
          appendCellsArrayId={appendCellsArrayId}
          onStartIteratorDrag={startIteratorDrag}
          onRelationshipStart={handleRelationshipStart}
          onRelationshipFinish={finishPointer}
        />
      </div>
      <LeetCodeModal
        isOpen={isLeetCodeModalOpen}
        onClose={closeLeetCodeModal}
        onImport={handleImportTestCases}
        initialProblemNumber="1"
      />
    </main>
  )
}

export default App
