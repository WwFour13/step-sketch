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
import {
  getCollectionElementIds,
  getCollectionValues,
  isSketchCollection,
} from './sketchCollections'

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
 * Calculates pan adjustment delta required to keep a bounding box (e.g. active editing cell)
 * visible within the canvas viewport bounds with specified padding.
 * Returns { x: deltaX, y: deltaY } to subtract from current pan (i.e. nextPan = pan - delta).
 */
export const calculateAutoPanDelta = (
  canvasBounds: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  targetBounds: { left: number; top: number; right: number; bottom: number; width: number; height: number },
  padding = 60,
): Position => {
  if (
    canvasBounds.width <= 0 ||
    canvasBounds.height <= 0 ||
    targetBounds.width <= 0 ||
    targetBounds.height <= 0
  ) {
    return { x: 0, y: 0 }
  }

  let deltaX = 0
  let deltaY = 0

  if (targetBounds.left < canvasBounds.left + padding) {
    deltaX = targetBounds.left - (canvasBounds.left + padding)
  } else if (targetBounds.right > canvasBounds.right - padding) {
    deltaX = targetBounds.right - (canvasBounds.right - padding)
  }

  if (targetBounds.top < canvasBounds.top + padding) {
    deltaY = targetBounds.top - (canvasBounds.top + padding)
  } else if (targetBounds.bottom > canvasBounds.bottom - padding) {
    deltaY = targetBounds.bottom - (canvasBounds.bottom - padding)
  }

  return { x: deltaX, y: deltaY }
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
 * Resolves the host sketch element for an iterator or cell ID.
 * Returns the matching node, variable, or collection element.
 */
export const getHostElement = (
  elements: SketchElement[],
  hostId: number,
): SketchElement | undefined => {
  return elements.find(
    (element) =>
      element.id === hostId ||
      (isSketchCollection(element) && getCollectionElementIds(element).includes(hostId)),
  )
}

/**
 * Calculates the stacking level (z-index) for all elements, iterators, and pointers.
 * - Base sketch elements (nodes, variables, collections) receive levels based on their
 *   stacking position in the sketch elements slice: (index + 1) * 10.
 * - Iterators receive the same level as their host element.
 * - Pointer arrows receive the level of their lowest edge node:
 *   min(level(sourceNode), level(targetNode)).
 */
export const getElementStackingLevel = (
  elements: SketchElement[],
  elementId: number,
): number => {
  // 1. Check if elementId is a sketch element (node, variable, collection)
  const sketchElements = elements.filter((el) => el.kind !== 'iterator')
  const sketchIndex = sketchElements.findIndex((el) => el.id === elementId)
  if (sketchIndex !== -1) {
    return (sketchIndex + 1) * 10
  }

  // 2. Check if elementId is an iterator
  const iterator = elements.find((el) => el.kind === 'iterator' && el.id === elementId)
  if (iterator && iterator.kind === 'iterator') {
    const host = getHostElement(elements, iterator.hostId)
    if (host) {
      return getElementStackingLevel(elements, host.id)
    }
  }

  // 3. Check if elementId is a collection cell ID
  const hostCollection = elements.find(
    (el) => isSketchCollection(el) && getCollectionElementIds(el).includes(elementId),
  )
  if (hostCollection) {
    return getElementStackingLevel(elements, hostCollection.id)
  }

  return 10
}

/**
 * Brings the specified element ID(s) to the front of their respective layer
 * (sketch elements within the sketch elements layer; iterators within the iterator layer).
 * If an array/matrix/map cell ID is provided, its parent collection is resolved and brought to front.
 * If multiple IDs are provided, their relative stacking order among each other is preserved.
 *
 * @param elements Complete list of sketch elements
 * @param targetIds Single element ID, array of IDs, or Set of IDs to bring to front
 * @returns Reordered list of sketch elements
 */
export const bringElementsToFront = (
  elements: SketchElement[],
  targetIds: number | number[] | Set<number>,
): SketchElement[] => {
  const rawTargetSet =
    targetIds instanceof Set
      ? targetIds
      : new Set(Array.isArray(targetIds) ? targetIds : [targetIds])

  if (rawTargetSet.size === 0) return elements

  const targetSet = new Set(rawTargetSet)

  // 1. Resolve any cell IDs to their parent collection ID
  for (const element of elements) {
    if (isSketchCollection(element)) {
      const cellIds = getCollectionElementIds(element)
      if (cellIds.some((cid) => rawTargetSet.has(cid))) {
        targetSet.add(element.id)
      }
    }
  }

  // 2. If an iterator is in targetSet, resolve its host element so both are elevated
  for (const element of elements) {
    if (element.kind === 'iterator' && targetSet.has(element.id)) {
      const host = getHostElement(elements, element.hostId)
      if (host) {
        targetSet.add(host.id)
      }
    }
  }

  // 3. If a host element is in targetSet, include all iterators hosted on it
  for (const element of elements) {
    if (element.kind === 'iterator') {
      const host = getHostElement(elements, element.hostId)
      if (host && targetSet.has(host.id)) {
        targetSet.add(element.id)
      }
    }
  }

  const unselectedSketch: SketchElement[] = []
  const selectedSketch: SketchElement[] = []
  const unselectedIterators: SketchElement[] = []
  const selectedIterators: SketchElement[] = []

  for (const element of elements) {
    if (element.kind === 'iterator') {
      if (targetSet.has(element.id)) {
        selectedIterators.push(element)
      } else {
        unselectedIterators.push(element)
      }
    } else {
      if (targetSet.has(element.id)) {
        selectedSketch.push(element)
      } else {
        unselectedSketch.push(element)
      }
    }
  }

  // If none of the target IDs matched any element, preserve original array
  if (selectedSketch.length === 0 && selectedIterators.length === 0) {
    return elements
  }

  return [
    ...unselectedSketch,
    ...selectedSketch,
    ...unselectedIterators,
    ...selectedIterators,
  ]
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

/** Formats elapsed time since last snapshot into readable status text. */
export const formatSaveStatus = (lastSnapshotTime: number, now: number): string => {
  const elapsedMs = Math.max(0, now - lastSnapshotTime)
  const elapsedSec = Math.floor(elapsedMs / 1000)

  if (elapsedSec < 5) {
    return `Saved just now (${elapsedSec}s)`
  }
  if (elapsedSec < 60) {
    return 'Saved < 1m ago'
  }

  const elapsedMin = Math.floor(elapsedSec / 60)
  if (elapsedMin === 1) {
    return 'Saved 1m ago'
  }
  if (elapsedMin < 60) {
    return `Saved ${elapsedMin}m ago`
  }

  const elapsedHour = Math.floor(elapsedMin / 60)
  if (elapsedHour === 1) {
    return 'Saved 1h ago'
  }
  return `Saved ${elapsedHour}h ago`
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
