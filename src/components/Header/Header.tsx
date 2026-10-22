import React, { useEffect, useState } from 'react'
import { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from '../../constants/sketch'
import { formatSaveStatus } from '../../utils/canvasState'

export type HeaderProps = {
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onResetBoard?: () => void
  lastSnapshotTime?: number
  zoom?: number
  onZoomIn?: () => void
  onZoomOut?: () => void
  onResetZoom?: () => void
}

/** Renders the application brand, board breadcrumb, and top-bar actions. */
export const Header: React.FC<HeaderProps> = ({
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onResetBoard,
  lastSnapshotTime,
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}) => {
  const [ticker, setTicker] = useState(() => Date.now())

  useEffect(() => {
    // Tick at 100ms so (0s) -> (1s) -> (2s) -> (3s) -> (4s) increments with uniform 1.00s accuracy
    const interval = setInterval(() => {
      setTicker(Date.now())
    }, 100)
    return () => clearInterval(interval)
  }, [lastSnapshotTime])

  const now = Math.max(ticker, lastSnapshotTime ?? 0)

  const saveText = lastSnapshotTime
    ? formatSaveStatus(lastSnapshotTime, now)
    : 'Saved just now'

  const formattedTime = lastSnapshotTime
    ? new Date(lastSnapshotTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : undefined

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
        <span
          className="save-status"
          title={formattedTime ? `Snapshot saved at ${formattedTime}` : 'Saved just now'}
        >
          {saveText}
        </span>
      </div>
      <div className="top-actions">
        <button
          className="icon-button"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          onClick={onUndo}
          disabled={!canUndo}
          style={{ opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}
        >
          ↶
        </button>
        <button
          className="icon-button"
          aria-label="Redo"
          title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          onClick={onRedo}
          disabled={!canRedo}
          style={{ opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'default' }}
        >
          ↷
        </button>
        {onResetBoard && (
          <button
            className="icon-button"
            aria-label="Reset board"
            title="Reset board to default elements"
            onClick={onResetBoard}
          >
            ↺
          </button>
        )}
        <span className="divider" />
        {(onZoomIn || onZoomOut || onResetZoom) && (
          <div className="zoom-controls">
            <button
              className="icon-button zoom-btn"
              aria-label="Zoom out"
              title="Zoom out (Ctrl+-)"
              onClick={onZoomOut}
              disabled={zoom <= MIN_CANVAS_ZOOM}
              style={{
                opacity: zoom <= MIN_CANVAS_ZOOM ? 0.4 : 1,
                cursor: zoom <= MIN_CANVAS_ZOOM ? 'default' : 'pointer',
              }}
            >
              −
            </button>
            <button
              className="zoom-level-button"
              aria-label="Reset zoom"
              title="Click to reset zoom to 100% (Ctrl+0)"
              onClick={onResetZoom}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              className="icon-button zoom-btn"
              aria-label="Zoom in"
              title="Zoom in (Ctrl+=)"
              onClick={onZoomIn}
              disabled={zoom >= MAX_CANVAS_ZOOM}
              style={{
                opacity: zoom >= MAX_CANVAS_ZOOM ? 0.4 : 1,
                cursor: zoom >= MAX_CANVAS_ZOOM ? 'default' : 'pointer',
              }}
            >
              +
            </button>
          </div>
        )}
        <span className="divider" />
        <button className="share-button">
          Share <span>↗</span>
        </button>
        <button className="avatar">JD</button>
      </div>
    </header>
  )
}

