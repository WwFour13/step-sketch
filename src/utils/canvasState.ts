import { CELL_SIZE } from '../constants/sketch'
import type {
  CanvasDiff,
  CanvasDimensions,
  CanvasDocument,
  CanvasState,
  CanvasViewport,
  ElementDiff,
  Position,
  SketchElement,
  SketchIterator,
  SpawnPlacementResult,
} from '../types/sketch'
import { elementBounds } from './canvas'
import { getCollectionValues, isSketchCollection } from './sketchCollections'

/** Converts screen viewport coordinates to canvas world coordinates. */
export const screenToCanvas = (
  screenPoint: Position,
  canvasRect: { left: number; top: number },
  viewport: CanvasViewport,
): Position => {
  const zoom = viewport.zoom <= 0 ? 1 : viewport.zoom
  return {
    x: (screenPoint.x - canvasRect.left - viewport.pan.x) / zoom,
    y: (screenPoint.y - canvasRect.top - viewport.pan.y) / zoom,
  }
}

/** Converts canvas world coordinates to screen viewport coordinates. */
export const canvasToScreen = (
  canvasPoint: Position,
  canvasRect: { left: number; top: number },
  viewport: CanvasViewport,
): Position => {
  return {
    x: canvasPoint.x * viewport.zoom + viewport.pan.x + canvasRect.left,
    y: canvasPoint.y * viewport.zoom + viewport.pan.y + canvasRect.top,
  }
}

/**
 * Clamps element position against the hard walls of the logical canvas boundaries.
 */
export const clampToWalls = (
  position: Position,
  elementSize: { width: number; height: number },
  dimensions: CanvasDimensions,
): Position => {
  const maxX = Math.max(0, dimensions.width - elementSize.width)
  const maxY = Math.max(0, dimensions.height - elementSize.height)
  return {
    x: Math.max(0, Math.min(position.x, maxX)),
    y: Math.max(0, Math.min(position.y, maxY)),
  }
}

/**
 * Clamps element position against the visible hard walls for the current zoom level and pan.
 */
export const clampToVisibleWalls = (
  position: Position,
  elementSize: { width: number; height: number },
  viewport: CanvasViewport,
  viewportPixelSize: { width: number; height: number },
): Position => {
  const zoom = viewport.zoom <= 0 ? 1 : viewport.zoom
  const visibleWidth = viewportPixelSize.width / zoom
  const visibleHeight = viewportPixelSize.height / zoom
  const maxX = Math.max(0, visibleWidth - elementSize.width)
  const maxY = Math.max(0, visibleHeight - elementSize.height)
  return {
    x: Math.max(0, Math.min(position.x, maxX)),
    y: Math.max(0, Math.min(position.y, maxY)),
  }
}

/**
 * Reorders elements to adjust layering (z-index) on the canvas.
 * Elements later in the array render on top of earlier elements.
 */
export const reorderElements = (
  elements: SketchElement[],
  action: 'bringToFront' | 'sendToBack' | 'bringForward' | 'sendBackward',
  targetId: number,
): SketchElement[] => {
  const index = elements.findIndex((el) => el.id === targetId)
  if (index === -1) return elements

  const copy = [...elements]
  const [item] = copy.splice(index, 1)

  switch (action) {
    case 'bringToFront':
      copy.push(item)
      break
    case 'sendToBack':
      copy.unshift(item)
      break
    case 'bringForward': {
      const nextIndex = Math.min(copy.length, index + 1)
      copy.splice(nextIndex, 0, item)
      break
    }
    case 'sendBackward': {
      const prevIndex = Math.max(0, index - 1)
      copy.splice(prevIndex, 0, item)
      break
    }
  }

  return copy
}

/**
 * Calculates a diff between two CanvasState snapshots.
 * Powers step-by-step animations and transitions between states.
 */
export const diffCanvasStates = (prev: CanvasState, next: CanvasState): CanvasDiff => {
  const prevElementsMap = new Map(prev.document.elements.map((el) => [el.id, el]))
  const nextElementsMap = new Map(next.document.elements.map((el) => [el.id, el]))

  const elementDiffs: ElementDiff[] = []

  // Check added or modified elements
  for (const nextEl of next.document.elements) {
    const prevEl = prevElementsMap.get(nextEl.id)
    if (!prevEl) {
      elementDiffs.push({ type: 'added', element: nextEl })
      continue
    }

    const positionChange =
      'position' in prevEl &&
      'position' in nextEl &&
      (prevEl.position.x !== nextEl.position.x || prevEl.position.y !== nextEl.position.y)
        ? { from: { ...prevEl.position }, to: { ...nextEl.position } }
        : undefined

    let valueChanged = false
    if (prevEl.kind !== nextEl.kind) {
      valueChanged = true
    } else if (prevEl.kind === 'variable' && nextEl.kind === 'variable') {
      valueChanged = prevEl.value !== nextEl.value
    } else if (prevEl.kind === 'node' && nextEl.kind === 'node') {
      valueChanged = prevEl.value !== nextEl.value
    } else if (isSketchCollection(prevEl) && isSketchCollection(nextEl)) {
      const prevVals = getCollectionValues(prevEl)
      const nextVals = getCollectionValues(nextEl)
      valueChanged =
        prevVals.length !== nextVals.length ||
        prevVals.some((val, idx) => val !== nextVals[idx])
    }

    let pointerChange: { addedPointers: number[]; removedPointers: number[] } | undefined
    if (prevEl.kind === 'node' && nextEl.kind === 'node') {
      const added = nextEl.pointer_ids.filter((id) => !prevEl.pointer_ids.includes(id))
      const removed = prevEl.pointer_ids.filter((id) => !nextEl.pointer_ids.includes(id))
      if (added.length > 0 || removed.length > 0) {
        pointerChange = { addedPointers: added, removedPointers: removed }
      }
    }

    let iteratorMove: { fromHostId: number; toHostId: number } | undefined
    if (prevEl.kind === 'iterator' && nextEl.kind === 'iterator') {
      if ((prevEl as SketchIterator).hostId !== (nextEl as SketchIterator).hostId) {
        iteratorMove = {
          fromHostId: (prevEl as SketchIterator).hostId,
          toHostId: (nextEl as SketchIterator).hostId,
        }
      }
    }

    if (positionChange || valueChanged || pointerChange || iteratorMove) {
      elementDiffs.push({
        type: 'modified',
        elementId: nextEl.id,
        positionChange,
        valueChanged,
        pointerChange,
        iteratorMove,
      })
    }
  }

  // Check removed elements
  for (const prevEl of prev.document.elements) {
    if (!nextElementsMap.has(prevEl.id)) {
      elementDiffs.push({ type: 'removed', elementId: prevEl.id })
    }
  }

  // Check layer order
  const prevOrder = prev.document.elements.map((el) => el.id)
  const nextOrder = next.document.elements.map((el) => el.id)
  const layerReordered =
    prevOrder.length === nextOrder.length && prevOrder.some((id, idx) => id !== nextOrder[idx])

  const viewportChange =
    prev.viewport.zoom !== next.viewport.zoom ||
    prev.viewport.pan.x !== next.viewport.pan.x ||
    prev.viewport.pan.y !== next.viewport.pan.y
      ? { from: { ...prev.viewport }, to: { ...next.viewport } }
      : undefined

  const dimensionsChange =
    prev.document.dimensions.width !== next.document.dimensions.width ||
    prev.document.dimensions.height !== next.document.dimensions.height
      ? { from: { ...prev.document.dimensions }, to: { ...next.document.dimensions } }
      : undefined

  return {
    elements: elementDiffs,
    viewportChange,
    dimensionsChange,
    layerReorders: layerReordered ? { fromOrder: prevOrder, toOrder: nextOrder } : undefined,
  }
}

/**
 * Calculates a non-overlapping spawn position for a new element on the canvas.
 * Acknowledges other elements and visible canvas boundaries; auto-zooms out if crowded.
 */
export const findNonOverlappingSpawnPosition = (
  existingElements: SketchElement[],
  newElementSize: { width: number; height: number },
  dimensions: CanvasDimensions,
  viewport: CanvasViewport,
  viewportPixelSize: { width: number; height: number } = { width: 1200, height: 800 },
): SpawnPlacementResult => {
  const PADDING = 24
  const startX = 88
  const startY = 88
  const stepX = CELL_SIZE
  const stepY = CELL_SIZE

  const existingBoxes = existingElements
    .filter((el) => el.kind !== 'iterator')
    .map((el) => elementBounds(el))

  const visibleWidth = viewportPixelSize.width / (viewport.zoom || 1)
  const visibleHeight = viewportPixelSize.height / (viewport.zoom || 1)

  const candidateMaxX = Math.min(dimensions.width, visibleWidth) - newElementSize.width - PADDING
  const candidateMaxY = Math.min(dimensions.height, visibleHeight) - newElementSize.height - PADDING

  // Try candidate positions in a readable grid scan
  for (let y = startY; y <= candidateMaxY; y += stepY) {
    for (let x = startX; x <= candidateMaxX; x += stepX) {
      const candidateBox = {
        left: x,
        right: x + newElementSize.width,
        top: y,
        bottom: y + newElementSize.height,
      }

      const collides = existingBoxes.some((box) => {
        return (
          candidateBox.left < box.x + box.width + PADDING &&
          candidateBox.right > box.x - PADDING &&
          candidateBox.top < box.y + box.height + PADDING &&
          candidateBox.bottom > box.y - PADDING
        )
      })

      if (!collides) {
        return { position: { x, y } }
      }
    }
  }

  // If no slot fits inside current visible viewport without overlap,
  // find a position outside the existing cluster and zoom out so it is visible.
  let maxY = startY
  for (const box of existingBoxes) {
    if (box.y + box.height > maxY) {
      maxY = box.y + box.height
    }
  }

  const fallbackY = maxY + PADDING * 2
  const fallbackX = startX

  const neededHeight = fallbackY + newElementSize.height + PADDING * 2
  const adjustedZoom =
    neededHeight > visibleHeight
      ? Math.max(0.3, Math.min(viewport.zoom, viewportPixelSize.height / neededHeight))
      : viewport.zoom

  return {
    position: { x: fallbackX, y: fallbackY },
    adjustedViewport:
      adjustedZoom !== viewport.zoom ? { ...viewport, zoom: adjustedZoom } : undefined,
    adjustedDimensions:
      neededHeight > dimensions.height
        ? { width: dimensions.width, height: Math.max(dimensions.height + 400, neededHeight + 200) }
        : undefined,
  }
}

/** Serializes a CanvasDocument to a formatted JSON string for saving or sharing. */
export const serializeCanvasDocument = (doc: CanvasDocument): string => {
  return JSON.stringify(doc, null, 2)
}

/** Parses and validates a JSON string into a CanvasDocument. */
export const deserializeCanvasDocument = (json: string): CanvasDocument | null => {
  try {
    const parsed = JSON.parse(json) as CanvasDocument
    if (
      parsed &&
      parsed.version === 1 &&
      typeof parsed.nextId === 'number' &&
      Array.isArray(parsed.elements) &&
      parsed.dimensions &&
      typeof parsed.dimensions.width === 'number' &&
      typeof parsed.dimensions.height === 'number'
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}
