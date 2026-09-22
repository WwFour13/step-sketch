import React from 'react'
import type { SketchElement, SketchIterator } from '../../types/sketch'

export type CanvasElementProps = {
  element: Exclude<SketchElement, SketchIterator>
  isSelected: boolean
  selectedCell: number | null
  onStartDrag: (event: React.PointerEvent, id: number) => void
  onHostDoubleClick: (event: React.MouseEvent) => void
  onSelectCell: (arrayId: number, index: number) => void
  onResetCellTyping: () => void
}

export const CanvasElement: React.FC<CanvasElementProps> = ({
  element,
  isSelected,
  selectedCell,
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
          <div className={`array-cells layout-${element.layout || 'horizontal'}`}>
            {element.values.map((value, index) => {
              const cellId = element.element_ids[index]
              const targetCellId =
                element.layout === 'map' && index % 2 !== 0
                  ? element.element_ids[index - 1]
                  : cellId
              return (
                <input
                  key={cellId}
                  data-host-cell-id={targetCellId}
                  value={value}
                  readOnly
                  draggable={false}
                  className={`array-cell-input ${
                    isSelected && (selectedCell === null || selectedCell === index)
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
        </>
      ) : (
        <>
          {element.label && <div className="element-label">{element.label}</div>}
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
