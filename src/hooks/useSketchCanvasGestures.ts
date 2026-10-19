import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import type {
  CellEditState,
  DragState,
  IteratorDragState,
  MarqueeDrag,
  MatrixResizeState,
  PointerDraft,
  RelationshipDrag,
  SelectionBox,
  SketchCollection,
  SketchElement,
  SketchIterator,
} from '../types/sketch'
import { CELL_SIZE, iteratorColors } from '../constants/sketch'
import { elementBounds, hostBounds, hostIdFromPoint } from '../utils/canvas'
import {
  getCollectionElementIds,
  getCollectionLayout,
  getCollectionValues,
  isSketchCollection,
} from '../utils/sketchCollections'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

export type MatrixResizeDrag = {
  id: number
  startPointerX: number
  startPointerY: number
  initialColumns: number
  initialRows: number
  initialValues: string[][]
  initialElementIds: number[][]
  allocatedIds: Map<string, number>
}

type UseSketchCanvasGesturesOptions = {
  elements: SketchElement[]
  setElements: Dispatch<SetStateAction<SketchElement[]>>
  canvasRef: RefObject<HTMLDivElement | null>
  nextId: number
  setNextId: Dispatch<SetStateAction<number>>
  selectedCell: number | null
  dragRef: MutableRefObject<DragState | null>
  pointerRef: MutableRefObject<PointerDraft | null>
  relationshipRef: MutableRefObject<RelationshipDrag | null>
  iteratorDragRef: MutableRefObject<{ id: number; startX: number; startY: number } | null>
  iteratorClickRef: MutableRefObject<{ id: number; time: number } | null>
  marqueeRef: MutableRefObject<MarqueeDrag | null>
  matrixResizeRef: MutableRefObject<MatrixResizeDrag | null>
  matrixResize: MatrixResizeState | null
  setMatrixResize: Dispatch<SetStateAction<MatrixResizeState | null>>
  setPointerDraft: Dispatch<SetStateAction<PointerDraft | null>>
  setSelectionBox: Dispatch<SetStateAction<SelectionBox | null>>
  setIteratorDrag: Dispatch<SetStateAction<IteratorDragState | null>>
  selectedIds: Set<number>
  selectedCellIds: Set<number>
  setSelectedIds: Dispatch<SetStateAction<Set<number>>>
  setSelectedCellIds: Dispatch<SetStateAction<Set<number>>>
  setSelectedId: Dispatch<SetStateAction<number>>
  setSelectedCell: Dispatch<SetStateAction<number | null>>
  cellEditRef: MutableRefObject<CellEditState | null>
  confirmCellEdit: (cellEdit: CellEditState | null) => unknown
  elementEditRef: MutableRefObject<{ elementId: number; hasTyped: boolean } | null>
  selectOne: (id: number, additive?: boolean) => void
  deleteElement: (id: number) => void
  resetCellTyping: () => void
}

export const useSketchCanvasGestures = ({
  elements,
  setElements,
  canvasRef,
  nextId,
  setNextId,
  selectedCell,
  dragRef,
  pointerRef,
  relationshipRef,
  iteratorDragRef,
  iteratorClickRef,
  marqueeRef,
  matrixResizeRef,
  matrixResize,
  setMatrixResize,
  setPointerDraft,
  setSelectionBox,
  setIteratorDrag,
  selectedIds,
  selectedCellIds,
  setSelectedIds,
  setSelectedCellIds,
  setSelectedId,
  setSelectedCell,
  cellEditRef,
  confirmCellEdit,
  elementEditRef,
  selectOne,
  deleteElement,
  resetCellTyping,
}: UseSketchCanvasGesturesOptions) => {
  /**
   * Advances an iterator one linked node or collection cell in its current
   * direction. Does nothing when the host has no valid next item.
   * @param iterator Iterator whose host position should advance.
   */
  const advanceIterator = (iterator: SketchIterator) => {
    const host =
      elements.find((element) => element.id === iterator.hostId && element.kind === 'node') ||
      elements.find(
        (element) =>
          isSketchCollection(element) && getCollectionElementIds(element).includes(iterator.hostId),
      )
    let nextHostId: number | null = null
    if (host?.kind === 'node' && host.pointer_ids.length === 1) nextHostId = host.pointer_ids[0]
    if (host && isSketchCollection(host)) {
      const elementIds = getCollectionElementIds(host)
      const index = elementIds.indexOf(iterator.hostId)
      if (host.kind === 'matrix') {
        const columns = Math.max(1, host.columns)
        const column = index % columns
        const step = iterator.mode === 'left' ? columns : 1
        if (
          index >= 0 &&
          (iterator.mode === 'left' ? index + step < elementIds.length : column + 1 < columns)
        ) {
          nextHostId = elementIds[index + step]
        }
      } else {
        const step = host.kind === 'map' ? 2 : 1
        if (index >= 0 && index + step < elementIds.length) {
          nextHostId = elementIds[index + step]
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
    event: ReactPointerEvent<HTMLDivElement>,
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
  const updateMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
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
          (element): element is SketchCollection =>
            isSketchCollection(element) &&
            selectedIds.has(element.id) &&
            !getCollectionElementIds(element).some((cellId) => selectedCellIds.has(cellId)),
        )
        .map((array) => array.id),
    )
    elements.forEach((element) => {
      if (element.kind === 'iterator') return
      const bounds = elementBounds(element)
      if (!intersects(bounds)) return
      if (!isSketchCollection(element)) {
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
      const layout = getCollectionLayout(element)
      const values = getCollectionValues(element)
      const elementIds = getCollectionElementIds(element)
      const columns = element.kind === 'matrix' ? Math.max(1, element.columns) : 1
      values.forEach((_, index) => {
        const column =
          layout === 'vertical'
            ? 0
            : layout === 'map'
              ? index % 2
              : layout === 'matrix'
                ? index % columns
                : index
        const row =
          layout === 'vertical'
            ? index
            : layout === 'map'
              ? Math.floor(index / 2)
              : layout === 'matrix'
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
      if (layout === 'map') {
        for (const index of [...selectedIndexes]) {
          const pairedIndex = index % 2 === 0 ? index + 1 : index - 1
          if (pairedIndex < elementIds.length) selectedIndexes.push(pairedIndex)
        }
      }
      if (selectedIndexes.length > 0) {
        selectedObjectIds.push(element.id)
        if (!marquee.additive || !previouslyWholeSelectedArrayIds.has(element.id)) {
          selectedIndexes.forEach((index) => selectedCellIdsInBox.add(elementIds[index]))
        }
      }
    })
    const isMultipleElements = !marquee.additive && selectedObjectIds.length > 1

    setSelectedIds((currentSelection) => {
      const next = marquee.additive ? new Set(currentSelection) : new Set<number>()
      selectedObjectIds.forEach((id) => next.add(id))
      return next
    })
    setSelectedCellIds((currentSelection) => {
      if (isMultipleElements) {
        return new Set<number>()
      }
      const next = marquee.additive ? new Set(currentSelection) : new Set<number>()
      elements.forEach((element) => {
        if (!isSketchCollection(element) || !selectedObjectIds.includes(element.id)) return
        const item = elementBounds(element)
        if (
          x <= item.x &&
          y <= item.y &&
          x + width >= item.x + item.width &&
          y + height >= item.y + item.height
        ) {
          getCollectionElementIds(element).forEach((cellId) => next.delete(cellId))
        }
      })
      selectedCellIdsInBox.forEach((cellId) => next.add(cellId))
      return next
    })
    if (selectedObjectIds.length > 0) setSelectedId(selectedObjectIds[0])
    setSelectedCell(null)
  }

  /**
   * Begins a canvas gesture on an element. A left-button press starts moving
   * the selected group; Shift-dragging a node includes its reachable nodes;
   * right-button dragging a node starts or edits its pointer connection.
   * @param event React pointer event carrying the button, modifiers, cursor
   *   coordinates, and capture target for the gesture.
   * @param id ID of the element that received the pointer event.
   */
  const startDrag = (event: ReactPointerEvent, id: number) => {
    window.getSelection()?.removeAllRanges()
    const element = elements.find((item) => item.id === id)
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!element || !bounds) return
    const targetCell = event.target instanceof Element && event.target.closest('.array-cell-input')
    if (event.button === 0 && event.shiftKey) {
      if (!targetCell) {
        selectOne(id, true)
      }
      return
    }
    if (cellEditRef.current && !targetCell) {
      confirmCellEdit(cellEditRef.current)
      cellEditRef.current = null
    }
    if (event.button === 0 && (element.kind === 'variable' || element.kind === 'node')) {
      elementEditRef.current = { elementId: id, hasTyped: false }
      cellEditRef.current = null
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    } else if (isSketchCollection(element)) {
      elementEditRef.current = null
    }
    const isArrayCellTarget =
      isSketchCollection(element) &&
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
    if (isSketchCollection(element) && !isArrayCellTarget) {
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
      if (isSketchCollection(selectedElement)) {
        getCollectionElementIds(selectedElement).forEach((elementId) => draggedIds.add(elementId))
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
   * Starts a resize drag from the matrix's bottom-right handle.
   * @param event Pointer-down event on the resize handle.
   * @param matrixId ID of the matrix being resized.
   */
  const startMatrixResize = (event: ReactPointerEvent, matrixId: number) => {
    window.getSelection()?.removeAllRanges()
    const matrix = elements.find(
      (item): item is Extract<SketchCollection, { kind: 'matrix' }> =>
        item.id === matrixId && item.kind === 'matrix',
    )
    if (!matrix) return

    if (cellEditRef.current) {
      confirmCellEdit(cellEditRef.current)
      cellEditRef.current = null
    }
    elementEditRef.current = null
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    resetCellTyping()

    selectOne(matrixId)
    setSelectedCell(null)
    setSelectedCellIds(new Set())

    const currentColumns = Math.max(1, matrix.columns)
    const currentRows = Math.max(1, matrix.values.length)

    matrixResizeRef.current = {
      id: matrixId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      initialColumns: currentColumns,
      initialRows: currentRows,
      initialValues: matrix.values.map((row) => [...row]),
      initialElementIds: matrix.element_ids.map((row) => [...row]),
      allocatedIds: new Map<string, number>(),
    }
    setMatrixResize({
      id: matrixId,
      targetColumns: currentColumns,
      targetRows: currentRows,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  /**
   * Updates matrix dimensions or contracting future-state highlight as the handle is dragged.
   * Only cells present in the initial matrix before drag are shown greyed-out when contracting.
   * @param event Pointer-move event carrying current cursor position.
   */
  const updateMatrixResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!matrixResizeRef.current) return
    const resize = matrixResizeRef.current
    const matrix = elements.find(
      (item): item is Extract<SketchCollection, { kind: 'matrix' }> =>
        item.id === resize.id && item.kind === 'matrix',
    )
    if (!matrix) return

    const deltaX = event.clientX - resize.startPointerX
    const deltaY = event.clientY - resize.startPointerY

    const colDiff = Math.floor((deltaX + 0.5 * CELL_SIZE) / CELL_SIZE)
    const rowDiff = Math.floor((deltaY + 0.5 * CELL_SIZE) / CELL_SIZE)

    const desiredColumns = Math.max(1, resize.initialColumns + colDiff)
    const desiredRows = Math.max(1, resize.initialRows + rowDiff)

    const displayedColumns = Math.max(resize.initialColumns, desiredColumns)
    const displayedRows = Math.max(resize.initialRows, desiredRows)

    if (displayedColumns !== matrix.columns || displayedRows !== matrix.values.length) {
      let currentNextId = nextId
      const nextValues: string[][] = []
      const nextElementIds: number[][] = []

      for (let r = 0; r < displayedRows; r++) {
        const rowValues: string[] = []
        const rowIds: number[] = []
        for (let c = 0; c < displayedColumns; c++) {
          if (r < resize.initialRows && c < resize.initialColumns) {
            rowValues.push(resize.initialValues[r][c])
            rowIds.push(resize.initialElementIds[r][c])
          } else {
            rowValues.push('')
            const key = `${r},${c}`
            let cellId = resize.allocatedIds.get(key)
            if (cellId === undefined) {
              cellId = currentNextId++
              resize.allocatedIds.set(key, cellId)
            }
            rowIds.push(cellId)
          }
        }
        nextValues.push(rowValues)
        nextElementIds.push(rowIds)
      }

      if (currentNextId !== nextId) {
        setNextId(currentNextId)
      }
      setElements((current) =>
        current.map((el) => {
          if (el.id !== matrix.id || el.kind !== 'matrix') return el
          return {
            ...el,
            columns: displayedColumns,
            values: nextValues,
            element_ids: nextElementIds,
          }
        }),
      )
    }

    setMatrixResize({
      id: matrix.id,
      targetColumns: desiredColumns,
      targetRows: desiredRows,
    })
  }

  /**
   * Updates the active iterator drag, pointer-connection draft, or element
   * group drag from the current pointer position.
   * @param event Pointer-move event over the canvas.
   */
  const moveElement = (event: ReactPointerEvent<HTMLDivElement>) => {
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
  const finishPointer = (event: ReactPointerEvent<HTMLDivElement | SVGLineElement>) => {
    if (matrixResizeRef.current) {
      const resize = matrixResizeRef.current
      const matrix = elements.find(
        (el): el is Extract<SketchCollection, { kind: 'matrix' }> =>
          el.id === resize.id && el.kind === 'matrix',
      )
      if (matrix && matrixResize) {
        const { targetColumns, targetRows } = matrixResize
        if (targetColumns < matrix.columns || targetRows < matrix.values.length) {
          const deletedCellIds = new Set<number>()
          for (let r = 0; r < matrix.values.length; r++) {
            for (let c = 0; c < matrix.columns; c++) {
              if (r >= targetRows || c >= targetColumns) {
                const cellId = matrix.element_ids[r]?.[c]
                if (cellId !== undefined) deletedCellIds.add(cellId)
              }
            }
          }
          const nextValues = matrix.values
            .slice(0, targetRows)
            .map((row) => row.slice(0, targetColumns))
          const nextElementIds = matrix.element_ids
            .slice(0, targetRows)
            .map((row) => row.slice(0, targetColumns))

          setElements((current) =>
            current
              .filter((el) => !(el.kind === 'iterator' && deletedCellIds.has(el.hostId)))
              .map((el) => {
                if (el.id !== matrix.id || el.kind !== 'matrix') return el
                return {
                  ...el,
                  columns: targetColumns,
                  values: nextValues,
                  element_ids: nextElementIds,
                }
              }),
          )
        }
      }
      matrixResizeRef.current = null
      setMatrixResize(null)
      return
    }

    if (iteratorDragRef.current) {
      const draggedIterator = iteratorDragRef.current
      const moved =
        Math.hypot(event.clientX - draggedIterator.startX, event.clientY - draggedIterator.startY) >
        4
      if (moved) {
        const hostId = hostIdFromPoint(elements, event.clientX, event.clientY)
        if (hostId !== null) {
          const hostArray = elements.find(
            (el): el is SketchCollection =>
              isSketchCollection(el) && getCollectionElementIds(el).includes(hostId),
          )
          let nextMode: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
          let nextHostId = hostId
          if (hostArray?.kind === 'set' || hostArray?.kind === 'map') {
            nextMode = 'left'
          } else if (hostArray?.kind === 'matrix') {
            const currentIterator = elements.find(
              (element): element is SketchIterator =>
                element.kind === 'iterator' && element.id === draggedIterator.id,
            )
            nextMode = currentIterator?.mode === 'left' ? 'left' : 'top'
            const elementIds = getCollectionElementIds(hostArray)
            const index = elementIds.indexOf(hostId)
            const columns = Math.max(1, hostArray.columns)
            const row = Math.floor(index / columns)
            const column = index % columns
            nextHostId = nextMode === 'left' ? elementIds[row * columns] : elementIds[column]
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
    event: ReactPointerEvent<SVGLineElement>,
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
  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    resetCellTyping()
    const startsMarquee =
      event.button === 0 && (event.target === event.currentTarget || event.shiftKey)
    if (startsMarquee) {
      confirmCellEdit(cellEditRef.current)
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
  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (matrixResizeRef.current) updateMatrixResize(event)
    else if (marqueeRef.current) updateMarquee(event)
    else moveElement(event)
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
    if (hostElement && isSketchCollection(hostElement)) {
      const elementIds = getCollectionElementIds(hostElement)
      if (selectedCell !== null && elementIds[selectedCell] !== undefined) {
        const cellIndex =
          hostElement.kind === 'map' && selectedCell % 2 !== 0 ? selectedCell - 1 : selectedCell
        targetHostId = elementIds[cellIndex]
      } else if (elementIds.length > 0) {
        targetHostId = elementIds[0]
      }
    }
    if (!hostBounds(elements, targetHostId)) return
    const id = nextId
    const count = elements.filter((element) => element.kind === 'iterator').length
    const hostArray = elements.find(
      (element): element is SketchCollection =>
        isSketchCollection(element) && getCollectionElementIds(element).includes(targetHostId),
    )
    let mode: 'top' | 'bottom' | 'left' | 'right' = hostArray ? 'top' : 'bottom'
    if (hostArray?.kind === 'set' || hostArray?.kind === 'map') {
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
  const handleHostDoubleClick = (event: ReactMouseEvent) => {
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
          (element): element is Extract<SketchCollection, { kind: 'matrix' }> =>
            element.kind === 'matrix' && getCollectionElementIds(element).includes(hostId),
        )
      : undefined
    if (matrix) {
      const elementIds = getCollectionElementIds(matrix)
      const index = elementIds.indexOf(hostId)
      const columns = Math.max(1, matrix.columns)
      const row = Math.floor(index / columns)
      const column = index % columns
      const iteratorCount = elements.filter((element) => element.kind === 'iterator').length
      const topIterator = createIterator(nextId, elementIds[column], 'top', iteratorCount)
      const leftIterator = createIterator(
        nextId + 1,
        elementIds[row * columns],
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
    if (hostElement && isSketchCollection(hostElement)) {
      const elementIds = getCollectionElementIds(hostElement)
      if (selectedCell !== null && elementIds[selectedCell] !== undefined) {
        const cellIndex =
          hostElement.kind === 'map' && selectedCell % 2 !== 0 ? selectedCell - 1 : selectedCell
        hostId = elementIds[cellIndex]
      } else if (elementIds.length > 0) {
        hostId = elementIds[0]
      }
    }

    let preferredMode: 'top' | 'bottom' | 'left' | 'right' | undefined
    if (
      hostElement &&
      isSketchCollection(hostElement) &&
      (hostElement.kind === 'set' || hostElement.kind === 'map')
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

  return {
    advanceIterator,
    startIteratorDrag,
    startMatrixResize,
    updateMarquee,
    startDrag,
    moveElement,
    finishPointer,
    handleRelationshipStart,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleHostDoubleClick,
  }
}
