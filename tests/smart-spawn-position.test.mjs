import assert from 'node:assert/strict'
import test from 'node:test'
import { CELL_SIZE, NODE_SIZE } from '../src/constants/sketch.ts'
import { findNonOverlappingSpawnPosition } from '../src/utils/canvasState.ts'

test('empty canvas places element at top-left reading order with padding snapped to grid', () => {
  const elements = []
  const size = { width: CELL_SIZE * 3, height: CELL_SIZE }
  const dimensions = { width: 3200, height: 1800 }
  const viewport = { zoom: 1.0, pan: { x: 0, y: 0 } }
  const screen = { width: 1420, height: 850 }

  const result = findNonOverlappingSpawnPosition(elements, size, dimensions, viewport, screen)

  // worldMinX = 0, worldMinY = 0
  // rawStartX = 32, rawStartY = 32 -> ceil(32/42)*42 = 42
  assert.equal(result.position.x, 42)
  assert.equal(result.position.y, 42)
  assert.equal(result.adjustedViewport, undefined)
})

test('scans in reading order (top-to-bottom, left-to-right) past existing obstacles', () => {
  // Existing element at (42, 42) with width 126, height 42
  const elements = [
    {
      id: 1,
      kind: 'array',
      label: 'arr',
      values: ['1', '2', '3'],
      element_ids: [2, 3, 4],
      position: { x: 42, y: 42 },
    },
  ]
  const size = { width: CELL_SIZE * 2, height: CELL_SIZE }
  const dimensions = { width: 3200, height: 1800 }
  const viewport = { zoom: 1.0, pan: { x: 0, y: 0 } }
  const screen = { width: 1420, height: 850 }

  const result = findNonOverlappingSpawnPosition(elements, size, dimensions, viewport, screen)

  // Obstacle right edge is 42 + 126 = 168. With 24px padding, safe X must be >= 168 + 24 = 192.
  // Next 42px grid step at or past 192 is ceil(192/42)*42 = 210.
  assert.equal(result.position.y, 42)
  assert.ok(result.position.x >= 192)
  assert.equal(result.position.x, 210)
})

test('wraps to next line when current horizontal line has no room', () => {
  // Fill the first row with a wide obstacle spanning almost the visible width
  const elements = [
    {
      id: 1,
      kind: 'array',
      label: 'wide',
      values: Array.from({ length: 30 }, (_, i) => String(i)),
      element_ids: Array.from({ length: 30 }, (_, i) => i + 2),
      position: { x: 42, y: 42 },
    },
  ]
  const size = { width: CELL_SIZE * 4, height: CELL_SIZE }
  const dimensions = { width: 3200, height: 1800 }
  const viewport = { zoom: 1.0, pan: { x: 0, y: 0 } }
  const screen = { width: 1420, height: 850 }

  const result = findNonOverlappingSpawnPosition(elements, size, dimensions, viewport, screen)

  // Should wrap to next line: y must be >= 42 + 42 + 24 = 108 -> ceil(108/42)*42 = 126
  assert.equal(result.position.x, 42)
  assert.equal(result.position.y, 126)
})

test('respects camera pan offset to spawn inside current visible viewport', () => {
  const elements = []
  const size = { width: NODE_SIZE, height: NODE_SIZE }
  const dimensions = { width: 3200, height: 1800 }
  // Viewport panned to world position (600, 300)
  const viewport = { zoom: 1.0, pan: { x: -600, y: -300 } }
  const screen = { width: 1420, height: 850 }

  const result = findNonOverlappingSpawnPosition(elements, size, dimensions, viewport, screen)

  // Visible world starts at 600, 300.
  // rawStartX = 600 + 32 = 632 -> ceil(632/42)*42 = 672
  // rawStartY = 300 + 32 = 332 -> ceil(332/42)*42 = 336
  assert.ok(result.position.x >= 600)
  assert.ok(result.position.y >= 300)
  assert.equal(result.position.x, 672)
  assert.equal(result.position.y, 336)
})

test('ignores iterators when computing collision obstacles', () => {
  const elements = [
    {
      id: 1,
      kind: 'iterator',
      hostId: 99,
      mode: 'top',
      color: '#ff0000',
    },
  ]
  const size = { width: CELL_SIZE, height: CELL_SIZE }
  const dimensions = { width: 3200, height: 1800 }
  const viewport = { zoom: 1.0, pan: { x: 0, y: 0 } }
  const screen = { width: 1420, height: 850 }

  const result = findNonOverlappingSpawnPosition(elements, size, dimensions, viewport, screen)

  // Iterator does not block (42, 42)
  assert.equal(result.position.x, 42)
  assert.equal(result.position.y, 42)
})

test('progressively zooms out when visible window is congested', () => {
  const screen = { width: 800, height: 600 }
  const dimensions = { width: 3200, height: 1800 }
  const viewport = { zoom: 1.0, pan: { x: 0, y: 0 } }

  // Create obstacles that completely pack the visible window at zoom 1.0 (800 x 600)
  const elements = []
  let nextId = 1
  for (let y = 30; y < 550; y += 70) {
    for (let x = 30; x < 750; x += 100) {
      elements.push({
        id: nextId++,
        kind: 'node',
        value: 'N',
        pointer_ids: [],
        pointer_limit: '+',
        position: { x, y },
      })
    }
  }

  const size = { width: 150, height: 80 }
  const result = findNonOverlappingSpawnPosition(elements, size, dimensions, viewport, screen)

  // Zoom should have stepped down below 1.0
  assert.ok(result.adjustedViewport)
  assert.ok(result.adjustedViewport.zoom < 1.0)
  assert.ok(result.adjustedViewport.zoom >= 0.5)

  // Returned position should not collide with any obstacle
  const PADDING = 24
  for (const el of elements) {
    const collides =
      result.position.x < el.position.x + NODE_SIZE + PADDING &&
      result.position.x + size.width > el.position.x - PADDING &&
      result.position.y < el.position.y + NODE_SIZE + PADDING &&
      result.position.y + size.height > el.position.y - PADDING
    assert.equal(collides, false, 'Spawned position must not collide with existing obstacle')
  }
})

test('completely congested canvas falls back to cascaded diagonal overlap', () => {
  const screen = { width: 500, height: 400 }
  const dimensions = { width: 600, height: 500 }
  const viewport = { zoom: 0.5, pan: { x: 0, y: 0 } }

  // Pack the entire dimensions so no slot fits even at 0.5x
  const elements = []
  let nextId = 1
  for (let y = 0; y < 500; y += 40) {
    for (let x = 0; x < 600; x += 40) {
      elements.push({
        id: nextId++,
        kind: 'node',
        value: 'X',
        pointer_ids: [],
        pointer_limit: '+',
        position: { x, y },
      })
    }
  }

  const size = { width: 200, height: 150 }
  const result = findNonOverlappingSpawnPosition(elements, size, dimensions, viewport, screen)

  // Should place at top-left visible area with cascade offset
  const cascadeIndex = elements.length % 8
  assert.equal(result.position.x, 32 + cascadeIndex * 24)
  assert.equal(result.position.y, 32 + cascadeIndex * 24)
})

test('composite structures treat bounding box as a single unit without layout distortion', () => {
  // Test binary tree layout preservation: 7 nodes
  const positions = [
    { x: 330, y: 110 },
    { x: 200, y: 240 },
    { x: 460, y: 240 },
    { x: 135, y: 370 },
    { x: 265, y: 370 },
    { x: 395, y: 370 },
    { x: 525, y: 370 },
  ]
  const minX = 135
  const minY = 110
  const treeWidth = 525 + NODE_SIZE - minX
  const treeHeight = 370 + NODE_SIZE - minY

  const elements = [
    {
      id: 1,
      kind: 'node',
      value: 'Obs',
      pointer_ids: [],
      pointer_limit: '+',
      position: { x: 42, y: 42 },
    },
  ]

  const spawnResult = findNonOverlappingSpawnPosition(
    elements,
    { width: treeWidth, height: treeHeight },
    { width: 3200, height: 1800 },
    { zoom: 1.0, pan: { x: 0, y: 0 } },
    { width: 1420, height: 850 },
  )

  const treeNodes = positions.map((pos, index) => ({
    id: 10 + index,
    kind: 'node',
    value: String(index + 1),
    position: {
      x: spawnResult.position.x + (pos.x - minX),
      y: spawnResult.position.y + (pos.y - minY),
    },
  }))

  // The relative spacing between root and left child must remain exactly (200 - 330) = -130, (240 - 110) = 130
  const shiftedRoot = treeNodes[0]
  const shiftedLeftChild = treeNodes[1]
  assert.equal(shiftedLeftChild.position.x - shiftedRoot.position.x, 200 - 330)
  assert.equal(shiftedLeftChild.position.y - shiftedRoot.position.y, 240 - 110)

  // Must not collide with obstacle
  for (const node of treeNodes) {
    const collidesWithObs =
      node.position.x < elements[0].position.x + NODE_SIZE &&
      node.position.x + NODE_SIZE > elements[0].position.x &&
      node.position.y < elements[0].position.y + NODE_SIZE &&
      node.position.y + NODE_SIZE > elements[0].position.y
    assert.equal(collidesWithObs, false)
  }
})
