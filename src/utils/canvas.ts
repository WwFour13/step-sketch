import { CELL_SIZE, MAP_CELL_WIDTH, NODE_RADIUS, NODE_SIZE } from '../constants/sketch'
import type { Position, SketchCollection, SketchElement, SketchIterator } from '../types/sketch'
import {
  getCollectionElementIds,
  getCollectionLayout,
  getCollectionValues,
  isSketchCollection,
} from './sketchCollections'

export { CELL_SIZE, MAP_CELL_WIDTH, NODE_SIZE }

/**
 * Returns the canvas-space rectangle occupied by an element. Array dimensions
 * depend on the array's layout, while iterators are positioned separately.
 */
export const elementBounds = (element: SketchElement) => {
  if (element.kind === 'iterator') {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  if (!isSketchCollection(element)) {
    return { x: element.position.x, y: element.position.y, width: NODE_SIZE, height: NODE_SIZE }
  }

  const layout = getCollectionLayout(element)
  const values = getCollectionValues(element)
  const columns = element.kind === 'matrix' ? element.columns : 1
  return {
    x: element.position.x,
    y: element.position.y,
    width:
      layout === 'vertical'
        ? NODE_SIZE
        : layout === 'map'
          ? MAP_CELL_WIDTH
          : layout === 'matrix'
            ? columns * CELL_SIZE
            : values.length * CELL_SIZE,
    height:
      layout === 'horizontal'
        ? NODE_SIZE
        : layout === 'map'
          ? Math.ceil(values.length / 2) * CELL_SIZE
          : layout === 'matrix'
            ? Math.ceil(values.length / columns) * CELL_SIZE
            : values.length * CELL_SIZE,
  }
}

/**
 * Resolves a node, array, or array-cell ID to its canvas-space bounds.
 * @param elements Current sketch elements, including array cells represented by IDs.
 * @param hostId ID of the requested node, array, or cell.
 * @returns Bounds for a valid host, or null when the ID has no drawable host.
 */
export const hostBounds = (
  elements: SketchElement[],
  hostId: number,
): { x: number; y: number; width: number; height: number } | null => {
  const host = elements.find((element) => element.id === hostId)
  if (host?.kind === 'node' || host?.kind === 'variable')
    return { x: host.position.x, y: host.position.y, width: NODE_SIZE, height: NODE_SIZE }
  if (host && isSketchCollection(host)) {
    const firstCellId = getCollectionElementIds(host)[0]
    if (firstCellId !== undefined) return hostBounds(elements, firstCellId)
  }
  const array = elements.find(
    (element): element is SketchCollection =>
      isSketchCollection(element) && getCollectionElementIds(element).includes(hostId),
  )
  if (!array) return null
  const elementIds = getCollectionElementIds(array)
  const index = elementIds.indexOf(hostId)
  const layout = getCollectionLayout(array)
  const effectiveIndex = layout === 'map' && index % 2 !== 0 ? index - 1 : index
  const columns = array.kind === 'matrix' ? Math.max(1, array.columns) : 1
  const column =
    layout === 'map' || layout === 'vertical'
      ? 0
      : layout === 'matrix'
        ? index % columns
        : effectiveIndex
  const row =
    layout === 'map'
      ? Math.floor(effectiveIndex / 2)
      : layout === 'vertical'
        ? effectiveIndex
        : layout === 'matrix'
          ? Math.floor(index / columns)
          : 0
  return {
    x: array.position.x + column * CELL_SIZE,
    y: array.position.y + row * CELL_SIZE,
    width: CELL_SIZE,
    height: CELL_SIZE,
  }
}

/**
 * Calculates an iterator's canvas position and offsets neighboring iterators
 * on the same side so their markers do not overlap.
 */
export const iteratorPosition = (elements: SketchElement[], iterator: SketchIterator) => {
  const bounds = hostBounds(elements, iterator.hostId)
  if (!bounds) return { x: 0, y: 0 }
  const mode = iterator.mode || 'bottom'
  const siblings = elements.filter(
    (element): element is SketchIterator =>
      element.kind === 'iterator' &&
      element.hostId === iterator.hostId &&
      (element.mode || 'bottom') === mode,
  )
  const siblingIndex = siblings.findIndex((item) => item.id === iterator.id)
  const offset = (siblingIndex - (siblings.length - 1) / 2) * 14

  switch (mode) {
    case 'top':
      return {
        x: bounds.x + bounds.width / 2 - 6 + offset,
        y: bounds.y - 14,
      }
    case 'left':
      return {
        x: bounds.x - 15,
        y: bounds.y + bounds.height / 2 - 4.5 + offset,
      }
    case 'right':
      return {
        x: bounds.x + bounds.width + 4,
        y: bounds.y + bounds.height / 2 - 4.5 + offset,
      }
    case 'bottom':
    default:
      return {
        x: bounds.x + bounds.width / 2 - 6 + offset,
        y: bounds.y + bounds.height + 5,
      }
  }
}

/**
 * Finds the node or array cell under a screen point, probing nearby points to
 * make dropping small iterator markers easier. Map value cells resolve to
 * their paired key cell.
 * @param elements Current sketch elements used to validate candidate hosts.
 * @param clientX Pointer's viewport-relative horizontal coordinate.
 * @param clientY Pointer's viewport-relative vertical coordinate.
 * @returns A host ID suitable for an iterator, or null if no host was found.
 */
export const hostIdFromPoint = (elements: SketchElement[], clientX: number, clientY: number) => {
  const offsets = [
    [0, 0],
    [0, -12],
    [0, 12],
    [-12, 0],
    [12, 0],
    [0, -24],
    [0, 24],
    [-24, 0],
    [24, 0],
  ]
  for (const [ox, oy] of offsets) {
    const target = document
      .elementFromPoint(clientX + ox, clientY + oy)
      ?.closest<HTMLElement>('[data-host-cell-id], [data-host-id]')
    if (!target) continue
    const cellId = target.dataset.hostCellId
    if (cellId && hostBounds(elements, Number(cellId))) {
      const numCellId = Number(cellId)
      const hostArr = elements.find(
        (el): el is SketchCollection =>
          isSketchCollection(el) && getCollectionElementIds(el).includes(numCellId),
      )
      if (hostArr?.kind === 'map') {
        const elementIds = getCollectionElementIds(hostArr)
        const idx = elementIds.indexOf(numCellId)
        if (idx % 2 !== 0) {
          return elementIds[idx - 1]
        }
      }
      return numCellId
    }
    const nodeId = target.dataset.hostId
    if (nodeId && hostBounds(elements, Number(nodeId))) {
      const numNodeId = Number(nodeId)
      const hostArr = elements.find((el) => el.id === numNodeId)
      if (hostArr && isSketchCollection(hostArr)) {
        const firstCellId = getCollectionElementIds(hostArr)[0]
        if (firstCellId !== undefined) return firstCellId
      }
      return numNodeId
    }
  }
  return null
}

/**
 * Trims a line between two node centers so its endpoints meet the node edges.
 */
export const pointerEndpoints = (source: Position, target: Position) => {
  const sourceCenter = { x: source.x + NODE_RADIUS, y: source.y + NODE_RADIUS }
  const targetCenter = { x: target.x + NODE_RADIUS, y: target.y + NODE_RADIUS }
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y
  const distance = Math.hypot(dx, dy) || 1
  return {
    x1: sourceCenter.x + (dx / distance) * NODE_RADIUS,
    y1: sourceCenter.y + (dy / distance) * NODE_RADIUS,
    x2: targetCenter.x - (dx / distance) * NODE_RADIUS,
    y2: targetCenter.y - (dy / distance) * NODE_RADIUS,
  }
}

/**
 * Formats an array's values for the multiline inspector editor according to
 * its layout (map pairs, matrix rows, vertical items, or comma-separated items).
 */
export const getArrayEditorValue = (array: SketchCollection) => {
  const layout = getCollectionLayout(array)
  const values = getCollectionValues(array)
  if (layout === 'map') {
    const pairs: string[] = []
    for (let index = 0; index < values.length; index += 2) {
      pairs.push(`${values[index] || ''}: ${values[index + 1] || ''}`)
    }
    return pairs.join('\n')
  }
  if (layout === 'matrix' && array.kind === 'matrix') {
    return array.values.map((row) => row.join(', ')).join('\n')
  }
  if (layout === 'vertical') return values.join('\n')
  return values.join(', ')
}

/**
 * Parses inspector text back into values for a non-matrix array layout.
 * Map entries use one key/value pair per line; other layouts split by line
 * or comma as appropriate.
 */
export const parseArrayEditorValue = (value: string, layout: 'horizontal' | 'vertical' | 'map') => {
  if (layout === 'map') {
    return value.split('\n').flatMap((line) => {
      const separator = line.indexOf(':')
      return separator < 0
        ? [line.trim(), '']
        : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
    })
  }
  if (layout === 'vertical') return value.split('\n').map((line) => line.trim())
  return value.split(',').map((item) => item.trim())
}

/**
 * Parses comma-separated matrix rows, padding shorter rows to a shared width.
 * @param value Multiline matrix text from the inspector.
 * @returns Flat cell values and the inferred column count.
 */
export const parseMatrixEditorValue = (value: string) => {
  const rows = value.split('\n').map((line) => line.split(',').map((item) => item.trim()))
  const columns = Math.max(1, ...rows.map((row) => row.length))
  return {
    columns,
    values: rows.map((row) => [...row, ...Array<string>(columns - row.length).fill('')]),
  }
}

/**
 * Recursively collects the given node ID and all descendant node IDs reachable
 * through outgoing pointer_ids. Traversal is cycle-safe and only includes nodes
 * that exist in the provided elements list.
 *
 * @param nodeId Starting root node ID
 * @param elements Complete list of sketch elements
 * @returns Set of node IDs containing nodeId and all reachable descendant nodes
 */
export const getRecursiveChildNodeIds = (
  nodeId: number,
  elements: SketchElement[],
): Set<number> => {
  const root = elements.find((item) => item.id === nodeId)
  if (root?.kind !== 'node') {
    return new Set<number>()
  }

  const result = new Set<number>([nodeId])
  const queue = [nodeId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const currentElement = elements.find((item) => item.id === currentId)
    if (currentElement?.kind !== 'node') continue

    for (const pointerId of currentElement.pointer_ids) {
      const child = elements.find((item) => item.id === pointerId)
      if (child?.kind === 'node' && !result.has(pointerId)) {
        result.add(pointerId)
        queue.push(pointerId)
      }
    }
  }

  return result
}
