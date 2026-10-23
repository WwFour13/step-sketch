import React from 'react'
import type { Position, SketchIterator } from '../../types/sketch'

/** Iterator record, computed position, selection state, and pointer handler. */
export type IteratorElementProps = {
  iterator: SketchIterator
  position: Position
  isSelected: boolean
  isDragging: boolean
  zIndex?: number
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>, iterator: SketchIterator) => void
}

/** Renders the colored directional marker attached to a canvas host. */
export const IteratorElement: React.FC<IteratorElementProps> = ({
  iterator,
  position,
  isSelected,
  isDragging,
  zIndex,
  onPointerDown,
}) => {
  return (
    <div
      className={`iterator-triangle color-${iterator.color} mode-${iterator.mode || 'bottom'} ${isSelected ? 'selected' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        pointerEvents: isDragging ? 'none' : 'auto',
        zIndex,
      }}
      title={
        iterator.label
          ? `${iterator.label} (Iterator on Cell ID: ${iterator.hostId})`
          : `Iterator on Cell ID: ${iterator.hostId}`
      }
      onPointerDown={(event) => onPointerDown(event, iterator)}
    />
  )
}
