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
  onAddIterator: (hostId: number) => void
}

export const CanvasElement: React.FC<CanvasElementProps> = ({
  element,
  isSelected,
  selectedCell,
  onStartDrag,
  onHostDoubleClick,
  onSelectCell,
  onResetCellTyping,
  onAddIterator,
}) => {
  return (
    <div
      data-node-id={element.kind === 'node' ? element.id : undefined}
      data-host-id={element.kind === 'node' ? element.id : undefined}
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
              const isHorizontalOrDef = !element.layout || element.layout === 'horizontal'
              return (
                <input
                  key={cellId}
                  data-host-cell-id={isHorizontalOrDef ? cellId : undefined}
                  value={value}
                  readOnly
                  className={`array-cell-input ${
                    isSelected && (selectedCell === null || selectedCell === index)
                      ? 'cell-active'
                      : ''
                  }`}
                  onPointerDown={() => {
                    onResetCellTyping()
                    onSelectCell(element.id, index)
                  }}
                  onMouseDown={(event) => {
                    onResetCellTyping()
                    if (isHorizontalOrDef && event.detail === 2) {
                      event.stopPropagation()
                      onAddIterator(cellId)
                    }
                    event.preventDefault()
                  }}
                  onSelect={(event) => event.currentTarget.setSelectionRange(0, 0)}
                />
              )
            })}
          </div>
        </>
      ) : (
        <>
          {element.label && <div className="element-label">{element.label}</div>}
          <div className="variable-square">
            <span className="variable-value">{element.value}</span>
          </div>
        </>
      )}
    </div>
  )
}
