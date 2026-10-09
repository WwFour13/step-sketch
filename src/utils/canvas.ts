import { CELL_SIZE, MAP_CELL_WIDTH, NODE_RADIUS, NODE_SIZE } from '../constants/sketch'
import type { Position, SketchArray, SketchElement, SketchIterator } from '../types/sketch'

export { CELL_SIZE, MAP_CELL_WIDTH, NODE_SIZE }

/**
 * Returns the canvas-space rectangle occupied by an element. Array dimensions
 * depend on the array's layout, while iterators are positioned separately.
 */
export const elementBounds = (element: SketchElement) => ({
  x: element.kind === 'iterator' ? 0 : element.position.x,
  y: element.kind === 'iterator' ? 0 : element.position.y,
  width:
    element.kind === 'iterator' ||
    element.kind === 'node' ||
    element.kind === 'variable' ||
    element.layout === 'vertical'
      ? NODE_SIZE
      : element.layout === 'map'
        ? MAP_CELL_WIDTH
        : element.layout === 'matrix'
          ? (element.columns ?? 1) * CELL_SIZE
          : element.values.length * CELL_SIZE,
  height:
    element.kind === 'iterator' ||
    element.kind === 'node' ||
    element.kind === 'variable' ||
    element.layout === 'horizontal' ||
    !element.layout
      ? NODE_SIZE
      : element.layout === 'map'
        ? Math.ceil(element.values.length / 2) * CELL_SIZE
        : element.layout === 'matrix'
          ? Math.ceil(element.values.length / Math.max(1, element.columns ?? 1)) * CELL_SIZE
          : element.values.length * CELL_SIZE,
})

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
  if (host?.kind === 'array' && host.element_ids.length > 0) {
    return hostBounds(elements, host.element_ids[0])
  }
  const array = elements.find(
    (element): element is SketchArray =>
      element.kind === 'array' && element.element_ids.includes(hostId),
  )
  if (!array) return null
  const index = array.element_ids.indexOf(hostId)
  const effectiveIndex = array.layout === 'map' && index % 2 !== 0 ? index - 1 : index
  const columns = Math.max(1, array.columns ?? 1)
  const column =
    array.layout === 'map' || array.layout === 'vertical'
      ? 0
      : array.layout === 'matrix'
        ? index % columns
        : effectiveIndex
  const row =
    array.layout === 'map'
      ? Math.floor(effectiveIndex / 2)
      : array.layout === 'vertical'
        ? effectiveIndex
        : array.layout === 'matrix'
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
        (el): el is SketchArray => el.kind === 'array' && el.element_ids.includes(numCellId),
      )
      if (hostArr?.layout === 'map') {
        const idx = hostArr.element_ids.indexOf(numCellId)
        if (idx % 2 !== 0) {
          return hostArr.element_ids[idx - 1]
        }
      }
      return numCellId
    }
    const nodeId = target.dataset.hostId
    if (nodeId && hostBounds(elements, Number(nodeId))) {
      const numNodeId = Number(nodeId)
      const hostArr = elements.find((el) => el.id === numNodeId)
      if (hostArr?.kind === 'array' && hostArr.element_ids.length > 0) {
        return hostArr.element_ids[0]
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
export const getArrayEditorValue = (array: SketchArray) => {
  if (array.layout === 'map') {
    const pairs: string[] = []
    for (let index = 0; index < array.values.length; index += 2) {
      pairs.push(`${array.values[index] || ''}: ${array.values[index + 1] || ''}`)
    }
    return pairs.join('\n')
  }
  if (array.layout === 'matrix') {
    const columns = Math.max(1, array.columns ?? 1)
    return Array.from({ length: Math.ceil(array.values.length / columns) }, (_, row) =>
      array.values.slice(row * columns, (row + 1) * columns).join(', '),
    ).join('\n')
  }
  if (array.layout === 'vertical') return array.values.join('\n')
  return array.values.join(', ')
}

/**
 * Parses inspector text back into values for a non-matrix array layout.
 * Map entries use one key/value pair per line; other layouts split by line
 * or comma as appropriate.
 */
export const parseArrayEditorValue = (value: string, layout: SketchArray['layout']) => {
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
    values: rows.flatMap((row) => [...row, ...Array<string>(columns - row.length).fill('')]),
  }
}
