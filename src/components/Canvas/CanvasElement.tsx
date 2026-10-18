import React from 'react'
import { CELL_SIZE } from '../../constants/sketch'
import type { SketchElement, SketchIterator } from '../../types/sketch'
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
  isInsertBefore,
  onStartDrag,
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

  return (
    <div
      data-node-id={element.kind === 'node' ? element.id : undefined}
      data-host-id={element.id}
      className={`canvas-element ${isSelected ? 'selected' : ''} kind-${element.kind}`}
      style={{ left: element.position.x, top: element.position.y }}
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
                const matrixColumns = Math.max(1, columns ?? 1)
                const row = Math.floor(index / matrixColumns)
                const column = index % matrixColumns
                const rowCount = Math.ceil(values.length / matrixColumns)
                const matrixCorners =
                  layout === 'matrix'
                    ? [
                        row === 0 && column === 0 && 'corner-top-left',
                        row === 0 && column === matrixColumns - 1 && 'corner-top-right',
                        row === rowCount - 1 && column === 0 && 'corner-bottom-left',
                        row === rowCount - 1 &&
                          column === matrixColumns - 1 &&
                          'corner-bottom-right',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : ''
                const isCellActive =
                  !(index === 0 && isInsertBeforeActive) &&
                  (selectedCellIds.has(cellId) ||
                    (isPrimarySelected && selectedCell === index) ||
                    (isSelected && selectedCell === null && !hasPartialCellSelection))
                return (
                  <input
                    key={cellId}
                    data-host-cell-id={targetCellId}
                    value={value}
                    readOnly
                    draggable={false}
                    className={`array-cell-input ${matrixCorners} ${isCellActive ? 'cell-active' : ''}`}
                    onPointerDown={() => {
                      onResetCellTyping()
                      onSelectCell(collection.id, index)
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
