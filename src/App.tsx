import { useEffect, useRef, useState } from 'react'
import './App.css'
import { Canvas } from './components/Canvas/Canvas'
import { Header } from './components/Header/Header'
import { LeetCodeModal } from './components/LeetCodeModal/LeetCodeModal'
import { Sidebar } from './components/Sidebar/Sidebar'
import { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from './constants/sketch'
import { useCanvasState } from './hooks/useCanvasState'
import { useSketchSelection, type CellEditConfirmation } from './hooks/useSketchSelection'
import { useSketchClipboard, type SketchClipboard } from './hooks/useSketchClipboard'
import { useSketchActions } from './hooks/useSketchActions'
import { useSketchKeyboard } from './hooks/useSketchKeyboard'
import { useSketchCanvasGestures, type MatrixResizeDrag } from './hooks/useSketchCanvasGestures'
import { useSketchDeletion } from './hooks/useSketchDeletion'
import { calculateAutoPanDelta, validateCanvasState } from './utils/canvasState'
import type {
  CellEditState,
  DragState,
  IteratorDragState,
  MarqueeDrag,
  MatrixResizeState,
  PointerDraft,
  RelationshipDrag,
  SelectionBox,
} from './types/sketch'

function App() {
  const {
    elements,
    nextId,
    setElements,
    setNextId,
    loadCanvasState,
    loadDocument,
    resetBoard,
    undo,
    redo,
    canUndo,
    canRedo,
    commitSnapshot,
    canvasState,
    viewport,
    dimensions,
    panBoundaryHit,
    zoomTo,
    setZoom,
    setPan,
    resetViewport,
    reorder,
    lastSnapshotTime,
  } = useCanvasState()
  const [isLeetCodeModalOpen, setIsLeetCodeModalOpen] = useState(false)
  const [screenDimensions, setScreenDimensions] = useState<{ width: number; height: number }>({
    width: 1420,
    height: 850,
  })

  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const pointerRef = useRef<PointerDraft | null>(null)
  const relationshipRef = useRef<RelationshipDrag | null>(null)
  const iteratorDragRef = useRef<{ id: number; startX: number; startY: number } | null>(null)
  const iteratorClickRef = useRef<{ id: number; time: number } | null>(null)
  const cellEditRef = useRef<CellEditState | null>(null)
  const clipboardRef = useRef<SketchClipboard | null>(null)
  const confirmCellEditRef = useRef<
    (cellEdit: CellEditState | null) => CellEditConfirmation | null
  >(() => null)
  const elementEditRef = useRef<{ elementId: number; hasTyped: boolean } | null>(null)
  const marqueeRef = useRef<MarqueeDrag | null>(null)
  const matrixResizeRef = useRef<MatrixResizeDrag | null>(null)

  const [pointerDraft, setPointerDraft] = useState<PointerDraft | null>(null)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)
  const [iteratorDrag, setIteratorDrag] = useState<IteratorDragState | null>(null)
  const [matrixResize, setMatrixResize] = useState<MatrixResizeState | null>(null)

  const {
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
  } = useSketchSelection({
    elements,
    setElements,
    cellEditRef,
  })
  useEffect(() => {
    confirmCellEditRef.current = (cellEdit) => {
      const res = confirmCellEdit(cellEdit)
      if (res) {
        commitSnapshot()
      }
      return res
    }
  }, [confirmCellEdit, commitSnapshot])

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

    const canvasEl = canvasRef.current
    if (!canvasEl) return

    // Ensure native scroll offsets are always 0 so virtual camera is never offset
    if (canvasEl.scrollLeft !== 0) canvasEl.scrollLeft = 0
    if (canvasEl.scrollTop !== 0) canvasEl.scrollTop = 0

    const arrayElement = canvasEl.querySelector<HTMLElement>(
      `.canvas-element[data-host-id="${cellEdit.arrayId}"]`,
    )
    const cells = arrayElement?.querySelectorAll<HTMLInputElement>('.array-cell-input')
    const targetCell = cells?.[cellEdit.index]
    if (!targetCell) return

    // Focus with preventScroll to prevent browser from natively scrolling .canvas or parent elements
    targetCell.focus({ preventScroll: true })

    const canvasBounds = canvasEl.getBoundingClientRect()
    const cellBounds = targetCell.getBoundingClientRect()
    const delta = calculateAutoPanDelta(canvasBounds, cellBounds, 60)

    if (delta.x !== 0 || delta.y !== 0) {
      setPan(
        (prev) => ({
          x: prev.x - delta.x,
          y: prev.y - delta.y,
        }),
        {
          width: canvasBounds.width,
          height: canvasBounds.height,
        },
      )
    }
  }, [elements, selectedCell, setPan])

  /** Resets the selected cell's numeric replacement state before editing. */
  const resetCellTyping = () => {
    if (cellEditRef.current) {
      cellEditRef.current.hasTyped = false
      cellEditRef.current.insertBefore = false
    }
    setIsInsertBefore(false)
  }

  const { deleteElement: rawDeleteElement, deleteSelection: rawDeleteSelection } =
    useSketchDeletion({
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
    })
  const deleteElement = (id: number) => {
    commitSnapshot()
    rawDeleteElement(id)
  }
  const deleteSelection = () => {
    commitSnapshot()
    rawDeleteSelection()
  }
  const { copySelection, pasteClipboard: rawPasteClipboard } = useSketchClipboard({
    elements,
    setElements,
    nextId,
    setNextId,
    selectedIds,
    setSelectedId,
    setSelectedIds,
    selectedCellIds,
    setSelectedCellIds,
    selectedCell,
    setSelectedCell,
    cellEditRef,
    elementEditRef,
    clipboardRef,
  })
  const pasteClipboard = () => {
    commitSnapshot()
    rawPasteClipboard()
  }

  const handleZoomIn = () => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    const canvasSize = bounds ? { width: bounds.width, height: bounds.height } : undefined
    zoomTo(
      (prev) => Math.min(MAX_CANVAS_ZOOM, +(prev + 0.1).toFixed(2)),
      undefined,
      undefined,
      canvasSize,
    )
  }
  const handleZoomOut = () => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    const canvasSize = bounds ? { width: bounds.width, height: bounds.height } : undefined
    zoomTo(
      (prev) => Math.max(MIN_CANVAS_ZOOM, +(prev - 0.1).toFixed(2)),
      undefined,
      undefined,
      canvasSize,
    )
  }
  const handleResetZoom = () => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    const canvasSize = bounds ? { width: bounds.width, height: bounds.height } : undefined
    zoomTo(1, undefined, undefined, canvasSize)
  }

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setScreenDimensions({ width: Math.round(width), height: Math.round(height) })
        }
      }
    })
    observer.observe(canvasEl)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const bounds = canvas.getBoundingClientRect()
      const mouseScreenX = event.clientX - bounds.left
      const mouseScreenY = event.clientY - bounds.top
      const canvasSize = { width: bounds.width, height: bounds.height }

      if (event.ctrlKey || event.metaKey) {
        const zoomDelta = -event.deltaY * 0.005
        zoomTo(
          (prevZoom) => {
            const nextZoom = prevZoom * (1 + zoomDelta)
            return Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, nextZoom))
          },
          mouseScreenX,
          mouseScreenY,
          canvasSize,
        )
      } else {
        const deltaModeMultiplier = event.deltaMode === 1 ? 16 : 1
        const dx = event.deltaX * deltaModeMultiplier
        const dy = event.deltaY * deltaModeMultiplier
        setPan(
          (prevPan) => ({
            x: prevPan.x - dx,
            y: prevPan.y - dy,
          }),
          canvasSize,
        )
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [zoomTo, setPan])

  useSketchKeyboard({
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
    undo,
    redo,
    commitSnapshot,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetZoom: handleResetZoom,
  })
  const {
    addVariable,
    addArray,
    addSet,
    addMap,
    addLinkedList,
    addBinaryTree,
    addMatrix,
    updateSelected,
    openLeetCodeModal,
    closeLeetCodeModal,
    handleImportTestCases,
  } = useSketchActions({
    elements,
    setElements,
    nextId,
    setNextId,
    selected,
    selectedId,
    selectOne,
    setSelectedIds,
    setSelectedId,
    cellEditRef,
    confirmCellEdit: (cellEdit) => confirmCellEditRef.current(cellEdit),
    setSelectedCell,
    setIsLeetCodeModalOpen,
  })
  const {
    startIteratorDrag,
    startMatrixResize,
    startDrag,
    finishPointer,
    handleRelationshipStart,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleHostDoubleClick,
  } = useSketchCanvasGestures({
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
    confirmCellEdit: (cellEdit) => confirmCellEditRef.current(cellEdit),
    elementEditRef,
    selectOne,
    deleteElement,
    resetCellTyping,
    commitSnapshot,
    zoom: viewport.zoom,
    pan: viewport.pan,
    dimensions,
    setIsInsertBefore,
  })
  // Expose canvasState API for external scripting, testing, and debugging
  useEffect(() => {
    ;(window as unknown as { __canvasStateApi?: unknown }).__canvasStateApi = {
      canvasState,
      loadCanvasState,
      loadDocument,
      resetBoard,
      undo,
      redo,
      zoomTo,
      setZoom,
      setPan,
      resetViewport,
      reorder,
      dimensions,
    }
  }, [
    canvasState,
    loadCanvasState,
    loadDocument,
    resetBoard,
    undo,
    redo,
    zoomTo,
    setZoom,
    setPan,
    resetViewport,
    reorder,
    dimensions,
  ])

  const handleSaveJson = () => {
    const blob = new Blob([JSON.stringify(canvasState, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const downloadAnchor = document.createElement('a')
    downloadAnchor.href = url
    downloadAnchor.download = 'step-sketch-untitled-board.json'
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    URL.revokeObjectURL(url)
  }

  const handleLoadJson = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result
        if (typeof text !== 'string') {
          window.alert('Failed to read JSON file.')
          return
        }
        const parsed = JSON.parse(text)
        const validatedState = validateCanvasState(parsed)
        if (!validatedState) {
          window.alert('Invalid Step-Sketch JSON file. Please check the file structure.')
          return
        }
        // Clear current element selection so it doesn't linger with stale element IDs
        setSelectedId(0)
        setSelectedIds(new Set())
        setSelectedCell(null)
        setSelectedCellIds(new Set())
        if (cellEditRef.current) cellEditRef.current = null
        if (elementEditRef.current) elementEditRef.current = null

        loadCanvasState(validatedState, false)
      } catch {
        window.alert('Invalid Step-Sketch JSON file. Parsing failed.')
      }
    }
    reader.onerror = () => {
      window.alert('Failed to read the selected file.')
    }
    reader.readAsText(file)
  }

  return (
    <main className="app-shell">
      <Header
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onResetBoard={resetBoard}
        lastSnapshotTime={lastSnapshotTime}
        zoom={viewport.zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onSaveJson={handleSaveJson}
        onLoadJson={handleLoadJson}
      />
      <div className="workspace">
        <Sidebar
          selected={selected}
          onUpdateSelected={(patch) => {
            commitSnapshot()
            updateSelected(patch)
          }}
          onDeleteElement={(id) => {
            commitSnapshot()
            if (selectedCellIds.size > 0) {
              deleteSelection()
            } else {
              deleteElement(id)
            }
          }}
          onAddVariable={(kind) => {
            commitSnapshot()
            addVariable(kind)
          }}
          onAddArray={(values, label, inputType) => {
            commitSnapshot()
            addArray(values, label, inputType)
          }}
          onAddLinkedList={() => {
            commitSnapshot()
            addLinkedList()
          }}
          onAddSet={() => {
            commitSnapshot()
            addSet()
          }}
          onAddMap={() => {
            commitSnapshot()
            addMap()
          }}
          onAddBinaryTree={() => {
            commitSnapshot()
            addBinaryTree()
          }}
          onAddMatrix={() => {
            commitSnapshot()
            addMatrix()
          }}
          onOpenLeetCodeModal={openLeetCodeModal}
        />
        <Canvas
          elements={elements}
          selectedIds={selectedIds}
          selectedCellIds={selectedCellIds}
          selectedId={selectedId}
          selectedCell={selectedCell}
          isInsertBefore={isInsertBefore}
          pointerDraft={pointerDraft}
          selectionBox={selectionBox}
          iteratorDrag={iteratorDrag}
          matrixResize={matrixResize}
          canvasRef={canvasRef}
          zoom={viewport.zoom}
          pan={viewport.pan}
          dimensions={dimensions}
          screenDimensions={screenDimensions}
          panBoundaryHit={panBoundaryHit}
          onCanvasPointerDown={handleCanvasPointerDown}
          onCanvasPointerMove={handleCanvasPointerMove}
          onCanvasPointerUp={(event) => {
            finishPointer(event)
          }}
          onStartDrag={(event, id) => {
            startDrag(event, id)
          }}
          onStartMatrixResize={(event, id) => {
            startMatrixResize(event, id)
          }}
          onHostDoubleClick={handleHostDoubleClick}
          onSelectCell={selectCell}
          onResetCellTyping={resetCellTyping}
          onStartIteratorDrag={(event, iterator) => {
            startIteratorDrag(event, iterator)
          }}
          onRelationshipStart={(event, sourceId, targetId) => {
            handleRelationshipStart(event, sourceId, targetId)
          }}
          onRelationshipFinish={(event) => {
            finishPointer(event)
          }}
        />
      </div>
      <LeetCodeModal
        isOpen={isLeetCodeModalOpen}
        onClose={closeLeetCodeModal}
        onImport={(importedElements, newNextId) => {
          commitSnapshot()
          handleImportTestCases(importedElements, newNextId)
        }}
        initialProblemNumber="1"
      />
    </main>
  )
}

export default App
