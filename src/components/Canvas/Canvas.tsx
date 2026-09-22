import React from 'react'
import type {
  IteratorDragState,
  PointerDraft,
  SelectionBox,
  SketchElement,
  SketchIterator,
} from '../../types/sketch'
import { iteratorPosition } from '../../utils/canvas'
import { CanvasElement } from './CanvasElement'
import { CanvasFooter } from './CanvasFooter'
import { IteratorElement } from './IteratorElement'
import { PointerLayer } from './PointerLayer'

export type CanvasProps = {
  elements: SketchElement[]
  selectedIds: Set<number>
  selectedCell: number | null
  pointerDraft: PointerDraft | null
  selectionBox: SelectionBox | null
  iteratorDrag: IteratorDragState | null
  canvasRef: React.RefObject<HTMLDivElement | null>
  onCanvasPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onCanvasPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onCanvasPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  onStartDrag: (event: React.PointerEvent, id: number) => void
  onHostDoubleClick: (event: React.MouseEvent) => void
  onSelectCell: (arrayId: number, index: number) => void
  onResetCellTyping: () => void
  onStartIteratorDrag: (event: React.PointerEvent<HTMLDivElement>, iterator: SketchIterator) => void
  onRelationshipStart: (
    event: React.PointerEvent<SVGLineElement>,
    sourceId: number,
    targetId: number,
  ) => void
  onRelationshipFinish: (event: React.PointerEvent<SVGLineElement>) => void
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedIds,
  selectedCell,
  pointerDraft,
  selectionBox,
  iteratorDrag,
  canvasRef,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onStartDrag,
  onHostDoubleClick,
  onSelectCell,
  onResetCellTyping,
  onStartIteratorDrag,
  onRelationshipStart,
  onRelationshipFinish,
}) => {
  const nonIteratorElements = elements.filter(
    (element): element is Exclude<SketchElement, SketchIterator> => element.kind !== 'iterator',
  )

  const iteratorElements = elements.filter(
    (element): element is SketchIterator => element.kind === 'iterator',
  )

  return (
    <section className="canvas-area">
      <div
        ref={canvasRef}
        className="canvas"
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={onCanvasPointerDown}
      >
        <PointerLayer
          elements={elements}
          pointerDraft={pointerDraft}
          onRelationshipStart={onRelationshipStart}
          onRelationshipFinish={onRelationshipFinish}
        />

        {nonIteratorElements.map((element) => (
          <CanvasElement
            key={element.id}
            element={element}
            isSelected={selectedIds.has(element.id)}
            selectedCell={selectedCell}
            onStartDrag={onStartDrag}
            onHostDoubleClick={onHostDoubleClick}
            onSelectCell={onSelectCell}
            onResetCellTyping={onResetCellTyping}
          />
        ))}

        {iteratorElements.map((iterator) => {
          const isDragging = iteratorDrag?.id === iterator.id
          const position = isDragging
            ? { x: iteratorDrag.x, y: iteratorDrag.y }
            : iteratorPosition(elements, iterator)

          return (
            <IteratorElement
              key={iterator.id}
              iterator={iterator}
              position={position}
              isSelected={selectedIds.has(iterator.id)}
              isDragging={isDragging}
              onPointerDown={onStartIteratorDrag}
            />
          )
        })}

        {selectionBox && (
          <div
            className="selection-box"
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}

        <div className="canvas-hint">
          <span>+</span>
          <span>Drag elements to arrange your explanation</span>
        </div>
      </div>

      <CanvasFooter />
    </section>
  )
}
