import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
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

export type UseCanvasStateReturn = {
  // Current composite state
  canvasState: CanvasState
  document: CanvasDocument
  viewport: CanvasViewport
  elements: SketchElement[]
  nextId: number
  dimensions: CanvasDimensions
  lastSnapshotTime: number

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
  setPan: (pan: Position | ((prev: Position) => Position)) => void
  resetViewport: () => void

  // Dimensions
  setDimensions: Dispatch<SetStateAction<CanvasDimensions>>

  // Layering (Z-Index)
  reorder: (
    action: 'bringToFront' | 'sendToBack' | 'bringForward' | 'sendBackward',
    targetId: number,
  ) => void
}

export const useCanvasState = (options: UseCanvasStateOptions = {}): UseCanvasStateReturn => {
  const { initialState = initialCanvasState, maxHistory = 50 } = options

  const [canvasState, setCanvasState] = useState<CanvasState>(initialState)
  const [history, setHistory] = useState<{ past: CanvasDocument[]; future: CanvasDocument[] }>({
    past: [],
    future: [],
  })
  const [lastSnapshotTime, setLastSnapshotTime] = useState<number>(() => Date.now())

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

  const setPan = useCallback((action: Position | ((prev: Position) => Position)) => {
    setCanvasState((current) => {
      const nextPan = typeof action === 'function' ? action(current.viewport.pan) : action
      return {
        ...current,
        viewport: {
          ...current.viewport,
          pan: nextPan,
        },
      }
    })
  }, [])

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
    setPan,
    resetViewport,

    setDimensions,
    reorder,
  }
}
