import { useEffect, useRef, useState } from 'react'
import './App.css'
import { Canvas } from './components/Canvas/Canvas'
import { Header } from './components/Header/Header'
import { LeetCodeModal } from './components/LeetCodeModal/LeetCodeModal'
import { Sidebar } from './components/Sidebar/Sidebar'
import { initialElements } from './constants/sketch'
import { useSketchSelection, type CellEditConfirmation } from './hooks/useSketchSelection'
import { useSketchClipboard, type SketchClipboard } from './hooks/useSketchClipboard'
import { useSketchActions } from './hooks/useSketchActions'
import { useSketchKeyboard } from './hooks/useSketchKeyboard'
import { useSketchCanvasGestures } from './hooks/useSketchCanvasGestures'
import { useSketchDeletion } from './hooks/useSketchDeletion'
import type {
  CellEditState,
  DragState,
  IteratorDragState,
  MarqueeDrag,
  PointerDraft,
  RelationshipDrag,
  SelectionBox,
  SketchElement,
} from './types/sketch'

function App() {
  const [elements, setElements] = useState<SketchElement[]>(initialElements)
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
  const clipboardRef = useRef<SketchClipboard | null>(null)
  const confirmCellEditRef = useRef<
    (cellEdit: CellEditState | null) => CellEditConfirmation | null
  >(() => null)
  const elementEditRef = useRef<{ elementId: number; hasTyped: boolean } | null>(null)
  const marqueeRef = useRef<MarqueeDrag | null>(null)

  const [pointerDraft, setPointerDraft] = useState<PointerDraft | null>(null)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)
  const [iteratorDrag, setIteratorDrag] = useState<IteratorDragState | null>(null)

  const {
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
  } = useSketchSelection({
    elements,
    setElements,
    cellEditRef,
    setAppendCellsArrayId,
  })
  useEffect(() => {
    confirmCellEditRef.current = confirmCellEdit
  }, [confirmCellEdit])

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

  /** Lets the next typed character replace the selected cell's current value. */
  const resetCellTyping = () => {
    if (cellEditRef.current) cellEditRef.current.hasTyped = false
    setAppendCellsArrayId(null)
  }

  const { deleteElement, deleteSelection } = useSketchDeletion({
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
    setAppendCellsArrayId,
  })
  const { copySelection, pasteClipboard } = useSketchClipboard({
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
    setAppendCellsArrayId,
    resetCellTyping,
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
  })
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
