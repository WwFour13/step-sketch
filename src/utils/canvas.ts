import { CELL_SIZE, MAP_CELL_WIDTH, NODE_RADIUS, NODE_SIZE } from '../constants/sketch'
import type { Position, SketchArray, SketchElement, SketchIterator } from '../types/sketch'

export { CELL_SIZE, MAP_CELL_WIDTH, NODE_SIZE }

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
        : element.values.length * CELL_SIZE,
})

export const hostBounds = (elements: SketchElement[], hostId: number) => {
  const host = elements.find((element) => element.id === hostId)
  if (host?.kind === 'node')
    return { x: host.position.x, y: host.position.y, width: NODE_SIZE, height: NODE_SIZE }
  const array = elements.find(
    (element): element is SketchArray =>
      element.kind === 'array' &&
      (!element.layout || element.layout === 'horizontal') &&
      element.element_ids.includes(hostId),
  )
  if (!array) return null
  const index = array.element_ids.indexOf(hostId)
  const column = array.layout === 'map' ? index % 2 : array.layout === 'vertical' ? 0 : index
  const row =
    array.layout === 'map' ? Math.floor(index / 2) : array.layout === 'vertical' ? index : 0
  return {
    x: array.position.x + column * CELL_SIZE,
    y: array.position.y + row * CELL_SIZE,
    width: CELL_SIZE,
    height: CELL_SIZE,
  }
}

export const iteratorPosition = (elements: SketchElement[], iterator: SketchIterator) => {
  const bounds = hostBounds(elements, iterator.hostId)
  if (!bounds) return { x: 0, y: 0 }
  const siblings = elements.filter(
    (element): element is SketchIterator =>
      element.kind === 'iterator' && element.hostId === iterator.hostId,
  )
  const siblingIndex = siblings.findIndex((item) => item.id === iterator.id)
  const horizontalOffset = (siblingIndex - (siblings.length - 1) / 2) * 14
  return { x: bounds.x + bounds.width / 2 - 6 + horizontalOffset, y: bounds.y + bounds.height + 5 }
}

export const hostIdFromPoint = (elements: SketchElement[], clientX: number, clientY: number) => {
  for (const offset of [0, 8, 16, 24, 32]) {
    const target = document
      .elementFromPoint(clientX, clientY - offset)
      ?.closest<HTMLElement>('[data-host-id], [data-host-cell-id]')
    if (!target) continue
    const cellId = target.dataset.hostCellId
    if (cellId && hostBounds(elements, Number(cellId))) return Number(cellId)
    const nodeId = target.dataset.hostId
    if (nodeId && hostBounds(elements, Number(nodeId))) return Number(nodeId)
  }
  return null
}

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

export const getArrayEditorValue = (array: SketchArray) => {
  if (array.layout === 'map') {
    const pairs: string[] = []
    for (let index = 0; index < array.values.length; index += 2) {
      pairs.push(`${array.values[index] || ''}: ${array.values[index + 1] || ''}`)
    }
    return pairs.join('\n')
  }
  if (array.layout === 'vertical') return array.values.join('\n')
  return array.values.join(', ')
}

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
