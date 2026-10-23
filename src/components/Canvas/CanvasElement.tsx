import React from 'react'
import { CELL_SIZE } from '../../constants/sketch'
import type { MatrixResizeState, SketchElement, SketchIterator } from '../../types/sketch'
import {
  getCollectionElementIds,
  getCollectionLayout,
  getCollectionValues,
  isSketchCollection,
} from '../../utils/sketchCollections'

/** Element data, selection state, and event callbacks for one canvas object. */
export type CanvasElementProps = {
  element: Exclude<SketchElement, SketchIterator>
  isSelected: boolean
  isPrimarySelected: boolean
  selectedCellIds: Set<number>
  selectedCell: number | null
  isInsertBefore?: boolean
  matrixResize?: MatrixResizeState | null
  zIndex?: number
  onStartDrag: (event: React.PointerEvent, id: number) => void
  onStartMatrixResize?: (event: React.PointerEvent, id: number) => void
  onHostDoubleClick: (event: React.MouseEvent) => void
  onSelectCell: (arrayId: number, index: number, additive?: boolean) => void
  onResetCellTyping: () => void
}

/**
 * Renders one variable, node, or array. Array cells expose host IDs so pointer
 * and iterator interactions can target individual cells.
 */
export const CanvasElement: React.FC<CanvasElementProps> = ({
  element,
  isSelected,
  isPrimarySelected,
  selectedCellIds,
  selectedCell,
  isInsertBefore,
  matrixResize,
  zIndex,
  onStartDrag,
  onStartMatrixResize,
  onHostDoubleClick,
  onSelectCell,
  onResetCellTyping,
}) => {
  const collection = isSketchCollection(element) ? element : null
  const values = collection ? getCollectionValues(collection) : []
  const elementIds = collection ? getCollectionElementIds(collection) : []
  const layout = collection ? getCollectionLayout(collection) : 'horizontal'
  const columns = collection?.kind === 'matrix' ? collection.columns : undefined
  const isInsertBeforeActive =
    Boolean(isInsertBefore) &&
    isPrimarySelected &&
    selectedCell === 0 &&
    collection?.kind === 'array' &&
    collection?.input_type === 'character'

  const isResizingThis = matrixResize?.id === element.id
  const activeCols = isResizingThis ? matrixResize.targetColumns : Math.max(1, columns ?? 1)
  const activeRows = isResizingThis
    ? matrixResize.targetRows
    : Math.ceil(values.length / Math.max(1, columns ?? 1))

  return (
    <div
      data-node-id={element.kind === 'node' ? element.id : undefined}
      data-host-id={element.id}
      className={`canvas-element ${isSelected ? 'selected' : ''} kind-${element.kind}`}
      style={{ left: element.position.x, top: element.position.y, zIndex }}
      onPointerDown={(event) => onStartDrag(event, element.id)}
      onDoubleClick={onHostDoubleClick}
    >
      {collection ? (
        <>
          <div className="element-label">{collection.label}</div>
          <div className="array-cells-container">
            <div
              className={`array-cells layout-${layout}`}
              style={
                layout === 'matrix'
                  ? { gridTemplateColumns: `repeat(${columns ?? 1}, ${CELL_SIZE}px)` }
                  : undefined
              }
            >
              {isInsertBeforeActive && (
                <div
                  className="array-cell-fake-insert"
                  aria-hidden="true"
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                />
              )}
              {values.map((value, index) => {
                const cellId = elementIds[index]
                const hasPartialCellSelection = elementIds.some((id) => selectedCellIds.has(id))
                const targetCellId =
                  collection.kind === 'map' && index % 2 !== 0 ? elementIds[index - 1] : cellId
                const numCols =
                  layout === 'matrix' ? Math.max(1, columns ?? 1) : layout === 'map' ? 2 : 1
                const row = Math.floor(index / numCols)
                const column = index % numCols
                const rowCount = Math.ceil(values.length / numCols)
                const is2D = layout === 'matrix' || layout === 'map'
                const gridClasses = is2D
                  ? [
                      row === 0 && column === 0 && 'corner-top-left',
                      row === 0 && column === numCols - 1 && 'corner-top-right',
                      row === rowCount - 1 && column === 0 && 'corner-bottom-left',
                      row === rowCount - 1 && column === numCols - 1 && 'corner-bottom-right',
                      column === numCols - 1 && 'edge-right',
                      row === rowCount - 1 && 'edge-bottom',
                    ]
                      .filter(Boolean)
                      .join(' ')
                  : ''

                const isFutureCell = !isResizingThis || (row < activeRows && column < activeCols)

                const activeGridClasses = isResizingThis
                  ? [
                      row === 0 && column === 0 && 'corner-top-left',
                      row === 0 &&
                        column === activeCols - 1 &&
                        'corner-top-right active-corner-top-right',
                      row === activeRows - 1 &&
                        column === 0 &&
                        'corner-bottom-left active-corner-bottom-left',
                      row === activeRows - 1 &&
                        column === activeCols - 1 &&
                        'corner-bottom-right active-corner-bottom-right',
                      column === activeCols - 1 && 'edge-right active-edge-right',
                      row === activeRows - 1 && 'edge-bottom active-edge-bottom',
                    ]
                      .filter(Boolean)
                      .join(' ')
                  : gridClasses

                const isCellActive = isResizingThis
                  ? isFutureCell
                  : selectedCellIds.has(cellId) ||
                    (isPrimarySelected && selectedCell === index) ||
                    (isSelected && selectedCell === null && !hasPartialCellSelection)

                // Check if neighbor to the left or above is active so this cell's borders form their right/bottom wall
                const isLeftActive =
                  layout === 'vertical'
                    ? false
                    : (is2D ? column > 0 : index > 0) &&
                      (isResizingThis
                        ? isFutureCell
                        : selectedCellIds.has(elementIds[index - 1]) ||
                          (isPrimarySelected && selectedCell === index - 1) ||
                          (isSelected && selectedCell === null && !hasPartialCellSelection))

                const isAboveActive =
                  layout === 'vertical'
                    ? index > 0 &&
                      (selectedCellIds.has(elementIds[index - 1]) ||
                        (isPrimarySelected && selectedCell === index - 1) ||
                        (isSelected && selectedCell === null && !hasPartialCellSelection))
                    : is2D &&
                      row > 0 &&
                      (isResizingThis
                        ? isFutureCell
                        : selectedCellIds.has(elementIds[index - numCols]) ||
                          (isPrimarySelected && selectedCell === index - numCols) ||
                          (isSelected && selectedCell === null && !hasPartialCellSelection))

                const resolvedGridClasses = isResizingThis
                  ? isFutureCell
                    ? activeGridClasses
                    : `${gridClasses} cell-contracting`
                  : gridClasses

                const isFirstCell = index === 0
                const isLastCell = index === values.length - 1
                const positionClasses = [
                  isFirstCell && 'cell-first',
                  isLastCell && 'cell-last',
                ]
                  .filter(Boolean)
                  .join(' ')

                const activeBorderClasses = [
                  isCellActive && 'cell-active',
                  isLeftActive && 'cell-left-active',
                  isAboveActive && 'cell-above-active',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <input
                    key={cellId}
                    data-host-cell-id={targetCellId}
                    value={value}
                    readOnly
                    draggable={false}
                    className={`array-cell-input ${resolvedGridClasses} ${positionClasses} ${activeBorderClasses}`}
                    onPointerDown={(event) => {
                      onResetCellTyping()
                      onSelectCell(collection.id, index, event.shiftKey)
                    }}
                    onMouseDown={() => {
                      onResetCellTyping()
                      window.getSelection()?.removeAllRanges()
                    }}
                    onDragStart={(event) => {
                      event.preventDefault()
                    }}
                    onDoubleClick={onHostDoubleClick}
                    onSelect={(event) => {
                      event.currentTarget.setSelectionRange(0, 0)
                      window.getSelection()?.removeAllRanges()
                    }}
                  />
                )
              })}
              {collection.kind === 'matrix' && onStartMatrixResize && (
                <div
                  className={`matrix-resize-handle ${isResizingThis ? 'active' : ''}`}
                  title="Drag to expand or contract matrix"
                  style={
                    isResizingThis
                      ? {
                          left: activeCols * CELL_SIZE - 4,
                          top: activeRows * CELL_SIZE - 4,
                          right: 'auto',
                          bottom: 'auto',
                        }
                      : undefined
                  }
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    event.preventDefault()
                    onStartMatrixResize(event, collection.id)
                  }}
                />
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {element.kind === 'variable' && element.label && (
            <div className="element-label">{element.label}</div>
          )}
          <div
            className="variable-square"
            data-node-id={element.kind === 'node' ? element.id : undefined}
            data-host-id={element.id}
          >
            <span className="variable-value">
              {element.kind === 'node' || element.kind === 'variable' ? element.value : ''}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
