import React from 'react'
import type { CanvasDimensions } from '../../types/sketch'

export type CanvasFooterProps = {
  dimensions?: CanvasDimensions
  zoom?: number
}

/** Displays the canvas keyboard hints and dynamic canvas dimensions. */
export const CanvasFooter: React.FC<CanvasFooterProps> = ({ dimensions, zoom }) => {
  const dimText = dimensions
    ? `${Math.round(dimensions.width)} x ${Math.round(dimensions.height)}`
    : '1200 x 760'
  const zoomText = zoom !== undefined ? ` • ${Math.round(zoom * 100)}%` : ''

  return (
    <footer className="canvas-footer">
      <span>
        <kbd>⌘</kbd> <kbd>Enter</kbd> to present
      </span>
      <span>
        <kbd>Delete</kbd> to remove selection
      </span>
      <span className="footer-right">
        Canvas {dimText}{zoomText} • 16:9
      </span>
    </footer>
  )
}
