import { useEffect, useRef, useState } from 'react'
import './App.css'
import { Canvas } from './components/Canvas/Canvas'
import { Header } from './components/Header/Header'
import { LeetCodeModal } from './components/LeetCodeModal/LeetCodeModal'
import { Sidebar } from './components/Sidebar/Sidebar'
import { useCanvasState } from './hooks/useCanvasState'
import { useSketchSelection, type CellEditConfirmation } from './hooks/useSketchSelection'
import { useSketchClipboard, type SketchClipboard } from './hooks/useSketchClipboard'
import { useSketchActions } from './hooks/useSketchActions'
import { useSketchKeyboard } from './hooks/useSketchKeyboard'
import { useSketchCanvasGestures, type MatrixResizeDrag } from './hooks/useSketchCanvasGestures'
import { useSketchDeletion } from './hooks/useSketchDeletion'
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
    setZoom,
    setPan,
    resetViewport,
    reorder,
    lastSnapshotTime,
  } = useCanvasState()
  const [isLeetCodeModalOpen, setIsLeetCodeModalOpen] = useState(false)
  const [problemStatus, setProblemStatus] = useState('')

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

    const arrayElement = canvasRef.current?.querySelector<HTMLElement>(
      `.canvas-element[data-host-id="${cellEdit.arrayId}"]`,
    )
    const cells = arrayElement?.querySelectorAll<HTMLInputElement>('.array-cell-input')
    cells?.[cellEdit.index]?.focus()
  }, [elements, selectedCell])

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
    setProblemStatus,
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
      setZoom,
      setPan,
      resetViewport,
      reorder,
    }
  }, [
    canvasState,
    loadCanvasState,
    loadDocument,
    resetBoard,
    undo,
    redo,
    setZoom,
    setPan,
    resetViewport,
    reorder,
  ])

  return (
    <main className="app-shell">
      <Header
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onResetBoard={resetBoard}
        lastSnapshotTime={lastSnapshotTime}
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
          problemStatus={problemStatus}
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
