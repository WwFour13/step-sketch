import React from 'react'
import { getPannableWorldDimensions, type PanBoundaryHit } from '../../hooks/useCanvasState'
import type {
  CanvasDimensions,
  IteratorDragState,
  MatrixResizeState,
  PointerDraft,
  Position,
  SelectionBox,
  SketchElement,
  SketchIterator,
} from '../../types/sketch'
import { iteratorPosition } from '../../utils/canvas'
import { getElementStackingLevel } from '../../utils/canvasState'
import { CanvasElement } from './CanvasElement'
import { CanvasFooter } from './CanvasFooter'
import { IteratorElement } from './IteratorElement'
import { PointerLayer } from './PointerLayer'

/** Inputs and gesture callbacks required to render and operate the sketch area. */
export type CanvasProps = {
  elements: SketchElement[]
  selectedIds: Set<number>
  selectedCellIds: Set<number>
  selectedId: number
  selectedCell: number | null
  isInsertBefore?: boolean
  pointerDraft: PointerDraft | null
  selectionBox: SelectionBox | null
  iteratorDrag: IteratorDragState | null
  matrixResize?: MatrixResizeState | null
  canvasRef: React.RefObject<HTMLDivElement | null>
  onCanvasPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onCanvasPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onCanvasPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
  onStartDrag: (event: React.PointerEvent, id: number) => void
  onStartMatrixResize?: (event: React.PointerEvent, id: number) => void
  onHostDoubleClick: (event: React.MouseEvent) => void
  onSelectCell: (arrayId: number, index: number, additive?: boolean) => void
  onResetCellTyping: () => void
  onStartIteratorDrag: (event: React.PointerEvent<HTMLDivElement>, iterator: SketchIterator) => void
  onRelationshipStart: (
    event: React.PointerEvent<SVGLineElement>,
    sourceId: number,
    targetId: number,
  ) => void
  onRelationshipFinish: (event: React.PointerEvent<SVGLineElement>) => void
  zoom?: number
  pan?: Position
  dimensions?: CanvasDimensions
  screenDimensions?: CanvasDimensions
  panBoundaryHit?: PanBoundaryHit
  onWheel?: (event: React.WheelEvent<HTMLDivElement>) => void
}

/**
 * Renders the canvas layers in stacking order: pointer lines, iterators,
 * other sketch elements, then the active selection rectangle.
 */
export const Canvas: React.FC<CanvasProps> = ({
  elements,
  selectedIds,
  selectedCellIds,
  selectedId,
  selectedCell,
  isInsertBefore,
  pointerDraft,
  selectionBox,
  iteratorDrag,
  matrixResize,
  canvasRef,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onStartDrag,
  onStartMatrixResize,
  onHostDoubleClick,
  onSelectCell,
  onResetCellTyping,
  onStartIteratorDrag,
  onRelationshipStart,
  onRelationshipFinish,
  zoom = 1,
  pan = { x: 0, y: 0 },
  dimensions,
  screenDimensions,
  panBoundaryHit,
  onWheel,
}) => {
  const pannableDimensions = getPannableWorldDimensions(
    zoom,
    screenDimensions ?? dimensions,
    dimensions,
    elements,
  )

  const nonIteratorElements = elements.filter(
    (element): element is Exclude<SketchElement, SketchIterator> => element.kind !== 'iterator',
  )

  const iteratorElements = elements.filter(
    (element): element is SketchIterator => element.kind === 'iterator',
  )

  const gridSize = Math.max(8, 22 * zoom)
  const patternOffsetX = ((pan.x % gridSize) + gridSize) % gridSize
  const patternOffsetY = ((pan.y % gridSize) + gridSize) % gridSize
  const dotRadius = Math.max(0.65, 0.9 * zoom)
  const cellBorderWidth =
    zoom < 1 ? Math.max(1, +(1.35 / zoom).toFixed(2)) : 1

  return (
    <section className="canvas-area">
      <div
        ref={canvasRef}
        className="canvas"
        onScroll={(event) => {
          if (event.currentTarget.scrollLeft !== 0) {
            event.currentTarget.scrollLeft = 0
          }
          if (event.currentTarget.scrollTop !== 0) {
            event.currentTarget.scrollTop = 0
          }
        }}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onLostPointerCapture={onCanvasPointerUp}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={onCanvasPointerDown}
        onWheel={onWheel}
      >
        <svg className="canvas-grid-bg" aria-hidden="true">
          <defs>
            <pattern
              id="canvas-grid-pattern"
              x={patternOffsetX}
              y={patternOffsetY}
              width={gridSize}
              height={gridSize}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={gridSize / 2}
                cy={gridSize / 2}
                r={dotRadius}
                className="canvas-grid-dot"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#canvas-grid-pattern)" />
        </svg>

        <div
          className="canvas-viewport"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            ['--canvas-zoom' as string]: `${zoom}`,
            ['--cell-border-width' as string]: `${cellBorderWidth}px`,
          }}
        >
          {/* Visual 16:9 Canvas Board Boundary */}
          <div
            className="canvas-board-boundary"
            style={{
              width: pannableDimensions.width,
              height: pannableDimensions.height,
            }}
            aria-hidden="true"
          />

          <PointerLayer
            elements={elements}
            pointerDraft={pointerDraft}
            onRelationshipStart={onRelationshipStart}
            onRelationshipFinish={onRelationshipFinish}
            getElementLevel={(id) => getElementStackingLevel(elements, id)}
          />

          {iteratorElements.map((iterator) => {
            const isDragging = iteratorDrag?.id === iterator.id
            const position = isDragging
              ? { x: iteratorDrag.x, y: iteratorDrag.y }
              : iteratorPosition(elements, iterator)
            const hostLevel = getElementStackingLevel(elements, iterator.hostId)
            const zIndex = isDragging ? 10000 : hostLevel + 2

            return (
              <IteratorElement
                key={iterator.id}
                iterator={iterator}
                position={position}
                isSelected={selectedIds.has(iterator.id)}
                isDragging={isDragging}
                zIndex={zIndex}
                onPointerDown={onStartIteratorDrag}
              />
            )
          })}

          {nonIteratorElements.map((element) => {
            const elementLevel = getElementStackingLevel(elements, element.id)
            const zIndex = elementLevel + 1

            return (
              <CanvasElement
                key={element.id}
                element={element}
                isSelected={selectedIds.has(element.id)}
                isPrimarySelected={selectedId === element.id}
                isMultiSelected={selectedIds.size > 1}
                selectedCellIds={selectedCellIds}
                selectedCell={selectedCell}
                isInsertBefore={isInsertBefore}
                matrixResize={matrixResize}
                zIndex={zIndex}
                onStartDrag={onStartDrag}
                onStartMatrixResize={onStartMatrixResize}
                onHostDoubleClick={onHostDoubleClick}
                onSelectCell={onSelectCell}
                onResetCellTyping={onResetCellTyping}
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
        </div>

        {/* Soft Screen Edge Boundary Vignette */}
        <div
          className={`canvas-edge-glow edge-left ${panBoundaryHit?.left ? 'active' : ''}`}
          aria-hidden="true"
        />
        <div
          className={`canvas-edge-glow edge-right ${panBoundaryHit?.right ? 'active' : ''}`}
          aria-hidden="true"
        />
        <div
          className={`canvas-edge-glow edge-top ${panBoundaryHit?.top ? 'active' : ''}`}
          aria-hidden="true"
        />
        <div
          className={`canvas-edge-glow edge-bottom ${panBoundaryHit?.bottom ? 'active' : ''}`}
          aria-hidden="true"
        />

        
      </div>

      <CanvasFooter dimensions={screenDimensions ?? dimensions} zoom={zoom} />
    </section>
  )
}
