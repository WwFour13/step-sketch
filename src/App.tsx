import React, { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { Canvas } from './components/Canvas/Canvas'
import { Header } from './components/Header/Header'
import { Sidebar } from './components/Sidebar/Sidebar'
import { initialElements, iteratorColors } from './constants/sketch'
import { fetchLeetCodeTestCase } from './services/leetcode'
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
  const [problemNumber, setProblemNumber] = useState('2')
  const [isLoadingProblem, setIsLoadingProblem] = useState(false)
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

  const selectCell = (arrayId: number, index: number) => {
    cellEditRef.current = { arrayId, index, hasTyped: false }
    setSelectedCell(index)
  }

  const resetCellTyping = () => {
    if (cellEditRef.current) cellEditRef.current.hasTyped = false
  }

  const selectOne = (id: number, additive = false) => {
    setSelectedIds((current) => {
      const next = additive ? new Set(current) : new Set<number>()
      next.add(id)
      return next
    })
    setSelectedId(id)
  }

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null
      const isEditing =
        activeElement?.id === 'label' ||
        activeElement?.id === 'value' ||
        activeElement?.id === 'problem-number'
      const cellEdit = cellEditRef.current
      if (cellEdit && !isEditing && (event.key.length === 1 || event.key === 'Backspace')) {
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
      if (event.key === 'Delete' && selectedId && !isEditing) {
        deleteElement(selectedId)
      }
    }

    const handleMouseDown = () => {
      resetCellTyping()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [deleteElement, selectedId])

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
        current.map((element) =>
          element.id === selectedId ? { ...element, ...patch } : element,
        ) as SketchElement[],
    )
  }

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
    let mode: 'top' | 'bottom' | 'left' | 'right' = 'bottom'
    if (hostArray?.layout === 'vertical' || hostArray?.layout === 'map') {
      mode = 'left'
    } else if (preferredMode === 'top' || preferredMode === 'bottom') {
      mode = preferredMode
    }
    const iterator: SketchIterator = {
      id,
      kind: 'iterator',
      hostId: targetHostId,
      color: iteratorColors[count % iteratorColors.length],
      mode,
    }
    setElements((current) => [...current, iterator])
    setNextId((current) => current + 1)
    selectOne(id)
  }

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
      const step = host.layout === 'map' ? 2 : 1
      if (index >= 0 && index + step < host.element_ids.length) {
        nextHostId = host.element_ids[index + step]
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

  const addVariable = (kind: 'variable' | 'node') => {
    const id = nextId
    const value = String(Math.floor(Math.random() * 10))
    const position = { x: 130 + (id % 3) * 70, y: 100 + (id % 3) * 60 }
    const element: SketchElement =
      kind === 'node'
        ? { id, kind, label: '', value, pointer_ids: [], position }
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
        layout: 'horizontal',
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

  const addLinkedList = () => {
    const firstId = nextId
    const nodes: SketchNode[] = [0, 1, 2].map((index) => ({
      id: firstId + index,
      kind: 'node',
      label: '',
      value: String(index + 1),
      pointer_ids: index < 2 ? [firstId + index + 1] : [],
      position: { x: 140 + index * 120, y: 170 },
    }))
    setElements((current) => [...current, ...nodes])
    setNextId((current) => current + nodes.length)
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
        label: '',
        value: String(index + 1),
        pointer_ids: pointerIds,
        position: positions[index],
      }
    })
    setElements((current) => [...current, ...nodes])
    setNextId((current) => current + nodes.length)
    selectOne(firstId)
  }

  const handleAddLeetCodeTestCase = async () => {
    setIsLoadingProblem(true)
    setProblemStatus('')
    try {
      const result = await fetchLeetCodeTestCase(problemNumber, nextId)
      setElements((current) => [...current, ...result.elements])
      setNextId(result.nextId)
      selectOne(result.firstId)
      setProblemStatus(result.status)
    } catch (err) {
      setProblemStatus(err instanceof Error ? err.message : 'Error loading problem')
    } finally {
      setIsLoadingProblem(false)
    }
  }

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
          if (hostArray?.layout === 'vertical' || hostArray?.layout === 'map') {
            nextMode = 'left'
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
                    hostId,
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
        return element.pointer_ids.includes(targetId)
          ? {
              ...element,
              pointer_ids: element.pointer_ids.filter((pointerId) => pointerId !== targetId),
            }
          : { ...element, pointer_ids: [...element.pointer_ids, targetId] }
      }),
    )
    pointerRef.current = null
    setPointerDraft(null)
  }

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
          problemNumber={problemNumber}
          onProblemNumberChange={setProblemNumber}
          onAddLeetCodeTestCase={handleAddLeetCodeTestCase}
          isLoadingProblem={isLoadingProblem}
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
    </main>
  )
}

export default App
