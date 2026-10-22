import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  CANVAS_ASPECT_RATIO_X,
  CANVAS_ASPECT_RATIO_Y,
  DEFAULT_CANVAS_DIMENSIONS,
  DEFAULT_CANVAS_VIEWPORT,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  initialCanvasDocument,
  initialCanvasState,
} from '../constants/sketch'
import type {
  CanvasDimensions,
  CanvasDocument,
  CanvasState,
  CanvasViewport,
  Position,
  SketchElement,
} from '../types/sketch'
import { reorderElements } from '../utils/canvasState'

export type UseCanvasStateOptions = {
  initialState?: CanvasState
  maxHistory?: number
}

export type PanBoundaryHit = {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
}

export type UseCanvasStateReturn = {
  // Current composite state
  canvasState: CanvasState
  document: CanvasDocument
  viewport: CanvasViewport
  elements: SketchElement[]
  nextId: number
  dimensions: CanvasDimensions
  lastSnapshotTime: number
  panBoundaryHit: PanBoundaryHit

  // Backward-compatible individual setters for existing hooks
  setElements: Dispatch<SetStateAction<SketchElement[]>>
  setNextId: Dispatch<SetStateAction<number>>

  // Atomic state loaders
  loadCanvasState: (state: CanvasState, clearHistory?: boolean) => void
  loadDocument: (doc: CanvasDocument, recordHistory?: boolean) => void
  resetBoard: () => void

  // History operations (Undo / Redo)
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  commitSnapshot: () => void

  // Viewport / Camera controls
  setViewport: Dispatch<SetStateAction<CanvasViewport>>
  setZoom: (zoom: number | ((prev: number) => number)) => void
  zoomTo: (
    targetZoomAction: number | ((prev: number) => number),
    pivotScreenX?: number,
    pivotScreenY?: number,
    canvasPixelSize?: { width: number; height: number },
  ) => void
  setPan: (
    pan: Position | ((prev: Position) => Position),
    canvasPixelSize?: { width: number; height: number },
  ) => void
  resetViewport: () => void

  // Dimensions
  setDimensions: Dispatch<SetStateAction<CanvasDimensions>>

  // Layering (Z-Index)
  reorder: (
    action: 'bringToFront' | 'sendToBack' | 'bringForward' | 'sendBackward',
    targetId: number,
  ) => void
}

/**
 * Calculates world dimensions for the maximum panning limits, guaranteeing
 * that the total accessible screen strictly conforms to a hardcoded 16:9 ratio.
 */
export const getPannableWorldDimensions = (
  zoom: number,
  canvasPixelSize?: { width: number; height: number },
  worldDimensions?: CanvasDimensions,
): CanvasDimensions => {
  const screenW = canvasPixelSize?.width ?? 1200
  const screenH = canvasPixelSize?.height ?? 800

  const baseW = worldDimensions?.width ?? DEFAULT_CANVAS_DIMENSIONS.width
  const baseH = worldDimensions?.height ?? DEFAULT_CANVAS_DIMENSIONS.height

  const requiredW = screenW / (zoom || 1)
  const requiredH = screenH / (zoom || 1)

  // Scale units in 16-by-9 blocks, ensuring screen coverage while strictly preserving 16:9 ratio
  let scaleUnits = Math.ceil(
    Math.max(
      baseW / CANVAS_ASPECT_RATIO_X,
      baseH / CANVAS_ASPECT_RATIO_Y,
      requiredW / CANVAS_ASPECT_RATIO_X,
      requiredH / CANVAS_ASPECT_RATIO_Y,
    ),
  )
  if (scaleUnits % 4 !== 0) {
    scaleUnits += 4 - (scaleUnits % 4)
  }

  return {
    width: scaleUnits * CANVAS_ASPECT_RATIO_X,
    height: scaleUnits * CANVAS_ASPECT_RATIO_Y,
  }
}

export const clampPan = (
  pan: Position,
  zoom: number,
  canvasPixelSize?: { width: number; height: number },
  worldDimensions?: CanvasDimensions,
): Position => {
  const screenW = canvasPixelSize?.width ?? 1200
  const screenH = canvasPixelSize?.height ?? 800
  const world = getPannableWorldDimensions(zoom, canvasPixelSize, worldDimensions)

  const scaledWorldW = world.width * zoom
  const scaledWorldH = world.height * zoom

  // Left boundary: pan.x <= 0 prevents camera from drifting right to reveal void to the left
  // Right boundary: pan.x >= screenW - scaledWorldW prevents camera from drifting past right edge
  const minX = screenW - scaledWorldW
  const maxX = 0
  const clampedX = Math.max(minX, Math.min(maxX, pan.x))

  // Top boundary: pan.y <= 0 prevents camera from drifting down to reveal void above
  // Bottom boundary: pan.y >= screenH - scaledWorldH
  const minY = screenH - scaledWorldH
  const maxY = 0
  const clampedY = Math.max(minY, Math.min(maxY, pan.y))

  return {
    x: Math.round(clampedX),
    y: Math.round(clampedY),
  }
}

export const useCanvasState = (options: UseCanvasStateOptions = {}): UseCanvasStateReturn => {
  const { initialState = initialCanvasState, maxHistory = 50 } = options

  const [canvasState, setCanvasState] = useState<CanvasState>(initialState)
  const [history, setHistory] = useState<{ past: CanvasDocument[]; future: CanvasDocument[] }>({
    past: [],
    future: [],
  })
  const [lastSnapshotTime, setLastSnapshotTime] = useState<number>(() => Date.now())
  const [panBoundaryHit, setPanBoundaryHit] = useState<PanBoundaryHit>({
    left: false,
    right: false,
    top: false,
    bottom: false,
  })
  const panBoundaryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stateRef = useRef(canvasState)
  useEffect(() => {
    stateRef.current = canvasState
  }, [canvasState])

  /** Commits the current document to undo history before an upcoming mutation. */
  const commitSnapshot = useCallback(() => {
    const currentDoc = stateRef.current.document
    setHistory((h) => ({
      past: [...h.past.slice(-(maxHistory - 1)), currentDoc],
      future: [],
    }))
    setLastSnapshotTime(Date.now())
  }, [maxHistory])

  /** Updates elements while preserving the rest of the canvas document. */
  const setElements: Dispatch<SetStateAction<SketchElement[]>> = useCallback((action) => {
    setCanvasState((current) => {
      const nextElements =
        typeof action === 'function' ? action(current.document.elements) : action
      if (nextElements === current.document.elements) return current
      return {
        ...current,
        document: {
          ...current.document,
          elements: nextElements,
        },
      }
    })
  }, [])

  /** Updates the next unique ID sequence number. */
  const setNextId: Dispatch<SetStateAction<number>> = useCallback((action) => {
    setCanvasState((current) => {
      const nextIdValue =
        typeof action === 'function' ? action(current.document.nextId) : action
      if (nextIdValue === current.document.nextId) return current
      return {
        ...current,
        document: {
          ...current.document,
          nextId: nextIdValue,
        },
      }
    })
  }, [])

  /** Atomically loads a complete CanvasState (document + viewport camera). */
  const loadCanvasState = useCallback(
    (newState: CanvasState, clearHistory = false) => {
      if (!clearHistory) {
        commitSnapshot()
      } else {
        setHistory({ past: [], future: [] })
      }
      setCanvasState(newState)
      setLastSnapshotTime(Date.now())
    },
    [commitSnapshot],
  )

  /** Atomically loads a CanvasDocument (elements, nextId, dimensions). */
  const loadDocument = useCallback(
    (newDoc: CanvasDocument, recordHistory = true) => {
      if (recordHistory) {
        commitSnapshot()
      }
      setCanvasState((current) => ({
        ...current,
        document: newDoc,
      }))
      setLastSnapshotTime(Date.now())
    },
    [commitSnapshot],
  )

  /** Resets the board back to default initial elements and camera view. */
  const resetBoard = useCallback(() => {
    setHistory({ past: [], future: [] })
    setCanvasState({
      document: initialCanvasDocument,
      viewport: DEFAULT_CANVAS_VIEWPORT,
    })
    setLastSnapshotTime(Date.now())
  }, [])

  /** Undoes the last committed document mutation. */
  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h
      const prevDoc = h.past[h.past.length - 1]
      const newPast = h.past.slice(0, h.past.length - 1)
      const currentDoc = stateRef.current.document

      setCanvasState((current) => ({
        ...current,
        document: prevDoc,
      }))
      setLastSnapshotTime(Date.now())

      return {
        past: newPast,
        future: [currentDoc, ...h.future],
      }
    })
  }, [])

  /** Redoes the last undone document mutation. */
  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h
      const nextDoc = h.future[0]
      const newFuture = h.future.slice(1)
      const currentDoc = stateRef.current.document

      setCanvasState((current) => ({
        ...current,
        document: nextDoc,
      }))
      setLastSnapshotTime(Date.now())

      return {
        past: [...h.past.slice(-(maxHistory - 1)), currentDoc],
        future: newFuture,
      }
    })
  }, [maxHistory])

  /** Viewport / Camera controls */
  const setViewport: Dispatch<SetStateAction<CanvasViewport>> = useCallback((action) => {
    setCanvasState((current) => {
      const nextViewport =
        typeof action === 'function' ? action(current.viewport) : action
      return {
        ...current,
        viewport: nextViewport,
      }
    })
  }, [])

  const setZoom = useCallback((action: number | ((prev: number) => number)) => {
    setCanvasState((current) => {
      const targetZoom =
        typeof action === 'function' ? action(current.viewport.zoom) : action
      const clampedZoom = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, targetZoom))
      if (clampedZoom === current.viewport.zoom) return current
      return {
        ...current,
        viewport: {
          ...current.viewport,
          zoom: clampedZoom,
        },
      }
    })
  }, [])

  /** Scales zoom centered around a screen pivot point (mouse cursor or canvas center). */
  const zoomTo = useCallback(
    (
      targetZoomAction: number | ((prev: number) => number),
      pivotScreenX?: number,
      pivotScreenY?: number,
      canvasPixelSize?: { width: number; height: number },
    ) => {
      setCanvasState((current) => {
        const oldZoom = current.viewport.zoom || 1
        const targetZoom =
          typeof targetZoomAction === 'function' ? targetZoomAction(oldZoom) : targetZoomAction
        const clampedZoom = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, targetZoom))
        if (clampedZoom === oldZoom) return current

        const canvasW = canvasPixelSize?.width ?? current.document.dimensions.width
        const canvasH = canvasPixelSize?.height ?? current.document.dimensions.height

        const pivotX = pivotScreenX ?? canvasW / 2
        const pivotY = pivotScreenY ?? canvasH / 2

        const oldPan = current.viewport.pan || { x: 0, y: 0 }
        const zoomRatio = clampedZoom / oldZoom
        const newPanX = pivotX - (pivotX - oldPan.x) * zoomRatio
        const newPanY = pivotY - (pivotY - oldPan.y) * zoomRatio

        const clampedPan = clampPan(
          { x: newPanX, y: newPanY },
          clampedZoom,
          canvasPixelSize,
          current.document.dimensions,
        )

        return {
          ...current,
          viewport: {
            zoom: Number(clampedZoom.toFixed(3)),
            pan: clampedPan,
          },
        }
      })
    },
    [],
  )

  const setPan = useCallback(
    (
      action: Position | ((prev: Position) => Position),
      canvasPixelSize?: { width: number; height: number },
    ) => {
      setCanvasState((current) => {
        const nextPan = typeof action === 'function' ? action(current.viewport.pan) : action
        const clampedPan = clampPan(
          nextPan,
          current.viewport.zoom,
          canvasPixelSize,
          current.document.dimensions,
        )

        const hitLeft = nextPan.x > clampedPan.x
        const hitRight = nextPan.x < clampedPan.x
        const hitTop = nextPan.y > clampedPan.y
        const hitBottom = nextPan.y < clampedPan.y

        if (hitLeft || hitRight || hitTop || hitBottom) {
          setPanBoundaryHit((prev) => ({
            left: hitLeft || prev.left,
            right: hitRight || prev.right,
            top: hitTop || prev.top,
            bottom: hitBottom || prev.bottom,
          }))
          if (panBoundaryTimeoutRef.current) {
            clearTimeout(panBoundaryTimeoutRef.current)
          }
          panBoundaryTimeoutRef.current = setTimeout(() => {
            setPanBoundaryHit({ left: false, right: false, top: false, bottom: false })
          }, 450)
        }

        return {
          ...current,
          viewport: {
            ...current.viewport,
            pan: clampedPan,
          },
        }
      })
    },
    [],
  )

  const resetViewport = useCallback(() => {
    setCanvasState((current) => ({
      ...current,
      viewport: DEFAULT_CANVAS_VIEWPORT,
    }))
  }, [])

  const setDimensions: Dispatch<SetStateAction<CanvasDimensions>> = useCallback((action) => {
    setCanvasState((current) => {
      const nextDimensions =
        typeof action === 'function' ? action(current.document.dimensions) : action
      return {
        ...current,
        document: {
          ...current.document,
          dimensions: nextDimensions,
        },
      }
    })
  }, [])

  const reorder = useCallback(
    (
      action: 'bringToFront' | 'sendToBack' | 'bringForward' | 'sendBackward',
      targetId: number,
    ) => {
      commitSnapshot()
      setCanvasState((current) => ({
        ...current,
        document: {
          ...current.document,
          elements: reorderElements(current.document.elements, action, targetId),
        },
      }))
    },
    [commitSnapshot],
  )

  return {
    canvasState,
    document: canvasState.document,
    viewport: canvasState.viewport,
    elements: canvasState.document.elements,
    nextId: canvasState.document.nextId,
    dimensions: canvasState.document.dimensions,
    lastSnapshotTime,
    panBoundaryHit,

    setElements,
    setNextId,

    loadCanvasState,
    loadDocument,
    resetBoard,

    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    commitSnapshot,

    setViewport,
    setZoom,
    zoomTo,
    setPan,
    resetViewport,

    setDimensions,
    reorder,
  }
}
