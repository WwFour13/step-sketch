import React, { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { Canvas } from './components/Canvas/Canvas'
import { Header } from './components/Header/Header'
import { LeetCodeModal } from './components/LeetCodeModal/LeetCodeModal'
import { Sidebar } from './components/Sidebar/Sidebar'
import { initialElements, iteratorColors } from './constants/sketch'
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

function App() {
  const [elements, setElements] = useState<SketchElement[]>(initialElements)
  const [selectedId, setSelectedId] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set([1]))
  const [selectedCell, setSelectedCell] = useState<number | null>(null)
  const [nextId, setNextId] = useState(15)
  const [isLeetCodeModalOpen, setIsLeetCodeModalOpen] = useState(false)
  const [problemStatus, setProblemStatus] = useState('')

  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const pointerRef = useRef<PointerDraft | null>(null)
  const relationshipRef = useRef<RelationshipDrag | null>(null)
  const iteratorDragRef = useRef<{ id: number; startX: number; startY: number } | null>(null)
  const iteratorClickRef = useRef<{ id: number; time: number } | null>(null)
  const cellEditRef = useRef<CellEditState | null>(null)
  const marqueeRef = useRef<MarqueeDrag | null>(null)

  const [pointerDraft, setPointerDraft] = useState<PointerDraft | null>(null)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)
  const [iteratorDrag, setIteratorDrag] = useState<IteratorDragState | null>(null)

  const selected = elements.find((element) => element.id === selectedId)

  /**
   * Selects a cell and initializes the typing state used to replace its value
   * on the first key press.
   * @param arrayId ID of the array that owns the cell.
   * @param index Zero-based index of the selected cell.
   */
  const selectCell = (arrayId: number, index: number) => {
    cellEditRef.current = { arrayId, index, hasTyped: false }
    setSelectedCell(index)
  }

  /** Lets the next typed character replace the selected cell's current value. */
  const resetCellTyping = () => {
    if (cellEditRef.current) cellEditRef.current.hasTyped = false
  }

  /**
   * Selects one element, optionally preserving the other selected IDs.
   * @param id ID of the element to make primary.
   * @param additive When true, retain the existing selection set.
   */
  const selectOne = (id: number, additive = false) => {
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
  }, [])

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
      const isEditing =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        Boolean(activeElement?.isContentEditable) ||
        activeElement?.id === 'label' ||
        activeElement?.id === 'value' ||
        activeElement?.id === 'problem-number' ||
        activeElement?.closest('.leetcode-modal-container') !== null

      const isArrayCell = activeElement?.classList.contains('array-cell-input') ?? false
      const isDeletingArrayCell = event.key === 'Delete' && isArrayCell
      if ((isEditing && !isDeletingArrayCell) || isLeetCodeModalOpen) {
        return
      }

      const cellEdit = cellEditRef.current
      if (cellEdit && (event.key.length === 1 || event.key === 'Backspace')) {
        event.preventDefault()
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
            values[cellEdit.index] =
              event.key === 'Backspace'
                ? cellEdit.hasTyped
                  ? values[cellEdit.index].slice(0, -1)
                  : ''
                : cellEdit.hasTyped
                  ? values[cellEdit.index] + event.key
                  : event.key
            cellEdit.hasTyped = true
            return { ...element, values }
          }),
        )
        return
      }
      const deleteTargetId = isArrayCell && cellEdit ? cellEdit.arrayId : selectedId
      if (event.key === 'Delete' && deleteTargetId) {
        deleteElement(deleteTargetId)
      }
    }

    /** Resets first-key replacement behavior when the user clicks elsewhere. */
    const handleMouseDown = () => {
      resetCellTyping()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [deleteElement, isLeetCodeModalOpen, selectedId])

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
          if (element.kind === 'node' && 'pointer_limit' in patch) {
            const pointerLimit = patch.pointer_limit ?? element.pointer_limit
            const pointerIds =
              pointerLimit === '+'
                ? element.pointer_ids
                : element.pointer_ids.slice(0, pointerLimit)
            return { ...element, ...patch, pointer_ids: pointerIds }
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
    const selectedInBox = elements
      .filter((element) => element.kind !== 'iterator')
      .filter((element) => {
        const item = elementBounds(element)
        return (
          item.x < x + width &&
          item.x + item.width > x &&
          item.y < y + height &&
          item.y + item.height > y
        )
      })
      .map((element) => element.id)
    setSelectedIds((currentSelection) => {
      const next = marquee.additive ? new Set(currentSelection) : new Set<number>()
      selectedInBox.forEach((id) => next.add(id))
      return next
    })
    if (selectedInBox.length > 0) setSelectedId(selectedInBox[0])
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
        ? { id, kind, label: '', value, pointer_ids: [], pointer_limit: '+', position }
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
      label: '',
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
        label: '',
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
    let activeSelection = selectedIds.has(id) ? new Set(selectedIds) : new Set([id])
    if (event.shiftKey && element.kind === 'node') {
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
    if (
      element.kind === 'array' &&
      (selectedIds.size > 1 || !(event.target instanceof HTMLInputElement))
    ) {
      setSelectedCell(null)
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
   * Starts marquee selection only when the primary button is pressed on the
   * canvas background; Shift preserves the current selection.
   * @param event Pointer-down event on the canvas container.
   */
  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    resetCellTyping()
    if (event.target === event.currentTarget && event.button === 0) {
      const bounds = canvasRef.current?.getBoundingClientRect()
      if (!bounds) return
      marqueeRef.current = {
        startX: event.clientX - bounds.left,
        startY: event.clientY - bounds.top,
        additive: event.shiftKey,
      }
      if (!event.shiftKey) {
        setSelectedIds(new Set())
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
          onDeleteElement={deleteElement}
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
