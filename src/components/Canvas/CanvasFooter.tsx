import React from 'react'

export const CanvasFooter: React.FC = () => {
  return (
    <footer className="canvas-footer">
      <span>
        <kbd>⌘</kbd> <kbd>Enter</kbd> to present
      </span>
      <span>
        <kbd>Delete</kbd> to remove selection
      </span>
      <span className="footer-right">Canvas 1200 x 760</span>
    </footer>
  )
}
