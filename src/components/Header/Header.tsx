import React from 'react'

export const Header: React.FC = () => {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">~</span>
        <span>
          sketch<span className="brand-accent">/</span>code
        </span>
      </div>
      <div className="breadcrumb">
        <span>Untitled board</span>
        <span className="dot">•</span>
        <span>Saved just now</span>
      </div>
      <div className="top-actions">
        <button className="icon-button" aria-label="Undo">
          ↶
        </button>
        <button className="icon-button" aria-label="Redo">
          ↷
        </button>
        <span className="divider" />
        <button className="share-button">
          Share <span>↗</span>
        </button>
        <button className="avatar">JD</button>
      </div>
    </header>
  )
}
