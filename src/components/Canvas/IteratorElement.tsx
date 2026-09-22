import React from 'react'
import type { Position, SketchIterator } from '../../types/sketch'

export type IteratorElementProps = {
  iterator: SketchIterator
  position: Position
  isSelected: boolean
  isDragging: boolean
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>, iterator: SketchIterator) => void
}

export const IteratorElement: React.FC<IteratorElementProps> = ({
  iterator,
  position,
  isSelected,
  isDragging,
  onPointerDown,
}) => {
  return (
    <div
      className={`iterator-triangle color-${iterator.color} mode-${iterator.mode || 'bottom'} ${isSelected ? 'selected' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        pointerEvents: isDragging ? 'none' : 'auto',
      }}
      title={`Iterator on Cell ID: ${iterator.hostId}`}
      onPointerDown={(event) => onPointerDown(event, iterator)}
    />
  )
}
