import React from 'react'
import { CELL_SIZE } from '../../constants/sketch'
import type { SketchElement, SketchIterator } from '../../types/sketch'

/** Element data, selection state, and event callbacks for one canvas object. */
export type CanvasElementProps = {
  element: Exclude<SketchElement, SketchIterator>
  isSelected: boolean
  isPrimarySelected: boolean
  selectedCellIds: Set<number>
  selectedCell: number | null
  isAppendingCells: boolean
  onStartDrag: (event: React.PointerEvent, id: number) => void
  onHostDoubleClick: (event: React.MouseEvent) => void
  onSelectCell: (arrayId: number, index: number) => void
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
  isAppendingCells,
  onStartDrag,
  onHostDoubleClick,
  onSelectCell,
  onResetCellTyping,
}) => {
  return (
    <div
      data-node-id={element.kind === 'node' ? element.id : undefined}
      data-host-id={element.id}
      className={`canvas-element ${isSelected ? 'selected' : ''} kind-${element.kind}`}
      style={{ left: element.position.x, top: element.position.y }}
      onPointerDown={(event) => onStartDrag(event, element.id)}
      onDoubleClick={onHostDoubleClick}
    >
      {element.kind === 'array' ? (
        <>
          <div className="element-label">{element.label}</div>
          <div className="array-cells-container">
            <div
              className={`array-cells layout-${element.layout || 'horizontal'}`}
              style={
                element.layout === 'matrix'
                  ? { gridTemplateColumns: `repeat(${element.columns ?? 1}, ${CELL_SIZE}px)` }
                  : undefined
              }
            >
              {element.values.map((value, index) => {
                const cellId = element.element_ids[index]
                const hasPartialCellSelection = element.element_ids.some((id) =>
                  selectedCellIds.has(id),
                )
                const targetCellId =
                  element.layout === 'map' && index % 2 !== 0
                    ? element.element_ids[index - 1]
                    : cellId
                const columns = Math.max(1, element.columns ?? 1)
                const row = Math.floor(index / columns)
                const column = index % columns
                const rowCount = Math.ceil(element.values.length / columns)
                const matrixCorners =
                  element.layout === 'matrix'
                    ? [
                        row === 0 && column === 0 && 'corner-top-left',
                        row === 0 && column === columns - 1 && 'corner-top-right',
                        row === rowCount - 1 && column === 0 && 'corner-bottom-left',
                        row === rowCount - 1 && column === columns - 1 && 'corner-bottom-right',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : ''
                return (
                  <input
                    key={cellId}
                    data-host-cell-id={targetCellId}
                    value={value}
                    readOnly
                    draggable={false}
                    className={`array-cell-input ${matrixCorners} ${
                      selectedCellIds.has(cellId) ||
                      (isPrimarySelected && selectedCell === index) ||
                      (isSelected && selectedCell === null && !hasPartialCellSelection)
                        ? 'cell-active'
                        : ''
                    }`}
                    onPointerDown={() => {
                      onResetCellTyping()
                      onSelectCell(element.id, index)
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
            </div>
            {isAppendingCells && <span className="array-append-indicator">+</span>}
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
            <span className="variable-value">{element.value}</span>
          </div>
        </>
      )}
    </div>
  )
}
