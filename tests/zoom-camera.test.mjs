import assert from 'node:assert/strict'
import test from 'node:test'

const MIN_CANVAS_ZOOM = 0.5
const MAX_CANVAS_ZOOM = 2.0

const CANVAS_ASPECT_RATIO_X = 16
const CANVAS_ASPECT_RATIO_Y = 9

const DEFAULT_CANVAS_DIMENSIONS = {
  width: 3200,
  height: 1800,
}

const clampZoom = (zoom) => {
  return Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, zoom))
}

const getPannableWorldDimensions = (zoom, canvasPixelSize, worldDimensions) => {
  const screenW = canvasPixelSize?.width ?? 1200
  const screenH = canvasPixelSize?.height ?? 800

  const baseW = worldDimensions?.width ?? DEFAULT_CANVAS_DIMENSIONS.width
  const baseH = worldDimensions?.height ?? DEFAULT_CANVAS_DIMENSIONS.height

  const requiredW = screenW / (zoom || 1)
  const requiredH = screenH / (zoom || 1)

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

const clampPan = (pan, zoom, canvasPixelSize, worldDimensions) => {
  const screenW = canvasPixelSize?.width ?? 1200
  const screenH = canvasPixelSize?.height ?? 800
  const world = getPannableWorldDimensions(zoom, canvasPixelSize, worldDimensions)

  const scaledWorldW = world.width * zoom
  const scaledWorldH = world.height * zoom

  const minX = screenW - scaledWorldW
  const maxX = 0
  const clampedX = Math.max(minX, Math.min(maxX, pan.x))

  const minY = screenH - scaledWorldH
  const maxY = 0
  const clampedY = Math.max(minY, Math.min(maxY, pan.y))

  return {
    x: Math.round(clampedX),
    y: Math.round(clampedY),
  }
}

const computeCellBorderWidth = (zoom) => {
  return zoom < 1 ? Math.max(1, +(1.35 / zoom).toFixed(2)) : 1
}

test('clampZoom enforces zoom boundaries between 0.5x and 2.0x', () => {
  assert.equal(clampZoom(0.2), 0.5)
  assert.equal(clampZoom(0.5), 0.5)
  assert.equal(clampZoom(1.0), 1.0)
  assert.equal(clampZoom(1.5), 1.5)
  assert.equal(clampZoom(2.0), 2.0)
  assert.equal(clampZoom(3.5), 2.0)
})

test('center zoom keeps the visible canvas center point invariant in world space', () => {
  const canvasW = 1200
  const canvasH = 800
  const pivotX = canvasW / 2
  const pivotY = canvasH / 2

  const oldZoom = 1.0
  const newZoom = 1.5
  const oldPan = { x: 0, y: 0 }

  const worldCenterBefore = {
    x: (pivotX - oldPan.x) / oldZoom,
    y: (pivotY - oldPan.y) / oldZoom,
  }

  const zoomRatio = newZoom / oldZoom
  const newPanX = pivotX - (pivotX - oldPan.x) * zoomRatio
  const newPanY = pivotY - (pivotY - oldPan.y) * zoomRatio

  const worldCenterAfter = {
    x: (pivotX - newPanX) / newZoom,
    y: (pivotY - newPanY) / newZoom,
  }

  assert.equal(worldCenterBefore.x, 600)
  assert.equal(worldCenterBefore.y, 400)
  assert.equal(worldCenterAfter.x, 600)
  assert.equal(worldCenterAfter.y, 400)
})

test('cursor pivot zoom keeps the exact point under cursor stationary', () => {
  const cursorX = 350
  const cursorY = 250

  const oldZoom = 1.0
  const newZoom = 1.4
  const oldPan = { x: 50, y: -20 }

  const worldCursorBefore = {
    x: (cursorX - oldPan.x) / oldZoom,
    y: (cursorY - oldPan.y) / oldZoom,
  }

  const zoomRatio = newZoom / oldZoom
  const newPanX = cursorX - (cursorX - oldPan.x) * zoomRatio
  const newPanY = cursorY - (cursorY - oldPan.y) * zoomRatio

  const worldCursorAfter = {
    x: (cursorX - newPanX) / newZoom,
    y: (cursorY - newPanY) / newZoom,
  }

  assert.equal(Math.round(worldCursorBefore.x * 100), Math.round(worldCursorAfter.x * 100))
  assert.equal(Math.round(worldCursorBefore.y * 100), Math.round(worldCursorAfter.y * 100))
})

test('clampPan restricts viewport from drifting out of bounds and prevents zooming out farther left', () => {
  const canvasSize = { width: 1200, height: 800 }
  const worldSize = { width: 3200, height: 1800 }

  // Extreme positive pan at zoom = 1.0 (trying to pan past left edge)
  const clampedFarLeft = clampPan({ x: 50000, y: 50000 }, 1.0, canvasSize, worldSize)
  assert.equal(clampedFarLeft.x, 0)
  assert.equal(clampedFarLeft.y, 0)

  // Zooming out from 1.0 to 0.7 when at left limit (pan.x = 0)
  const clampedAfterZoomOut = clampPan({ x: 100, y: 100 }, 0.7, canvasSize, worldSize)
  assert.equal(clampedAfterZoomOut.x, 0) // Cannot see farther left than x = 0!
  assert.equal(clampedAfterZoomOut.y, 0)

  // Extreme negative pan at zoom = 1.0 (trying to pan past right edge)
  const clampedFarRight = clampPan({ x: -50000, y: -50000 }, 1.0, canvasSize, worldSize)
  assert.equal(clampedFarRight.x, 1200 - 3200) // -2000
  assert.equal(clampedFarRight.y, 800 - 1800) // -1000
})

test('maximum panning limits strictly enforce a hardcoded 16:9 total screen ratio', () => {
  const testViewports = [
    { width: 1200, height: 800 },
    { width: 1420, height: 850 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1080 }, // ultrawide
    { width: 800, height: 1200 }, // portrait
  ]
  const testZooms = [0.5, 0.75, 1.0, 1.5, 2.0]

  for (const viewport of testViewports) {
    for (const zoom of testZooms) {
      const world = getPannableWorldDimensions(zoom, viewport)
      // Assert exact 16:9 aspect ratio in world dimensions
      assert.equal(world.width * 9, world.height * 16)
      assert.equal(world.width / world.height, 16 / 9)

      // Test panning bounds
      const farRightBottom = clampPan({ x: -1000000, y: -1000000 }, zoom, viewport)
      // Total accessible screen in world coordinates
      const totalWorldWidth = (viewport.width - farRightBottom.x) / zoom
      const totalWorldHeight = (viewport.height - farRightBottom.y) / zoom

      assert.equal(Math.round(totalWorldWidth * 9), Math.round(totalWorldHeight * 16))
      assert.equal(+(totalWorldWidth / totalWorldHeight).toFixed(5), +(16 / 9).toFixed(5))
    }
  }
})

test('detects pan boundary hit when panning past min or max limits', () => {
  const canvasSize = { width: 1200, height: 800 }
  const world = getPannableWorldDimensions(1.0, canvasSize)
  const minX = canvasSize.width - world.width
  const minY = canvasSize.height - world.height

  // Panning within bounds: no hit
  const normalClamped = clampPan({ x: -100, y: -50 }, 1.0, canvasSize)
  assert.equal(-100 > normalClamped.x, false)
  assert.equal(-100 < normalClamped.x, false)

  // Panning past left: nextPan.x > clampedPan.x
  const leftClamped = clampPan({ x: 25, y: -50 }, 1.0, canvasSize)
  assert.equal(25 > leftClamped.x, true) // Hit left

  // Panning past right: nextPan.x < clampedPan.x
  const rightClamped = clampPan({ x: minX - 40, y: -50 }, 1.0, canvasSize)
  assert.equal(minX - 40 < rightClamped.x, true) // Hit right

  // Panning past top: nextPan.y > clampedPan.y
  const topClamped = clampPan({ x: -50, y: 15 }, 1.0, canvasSize)
  assert.equal(15 > topClamped.y, true) // Hit top

  // Panning past bottom: nextPan.y < clampedPan.y
  const bottomClamped = clampPan({ x: -50, y: minY - 30 }, 1.0, canvasSize)
  assert.equal(minY - 30 < bottomClamped.y, true) // Hit bottom
})

test('computeCellBorderWidth guarantees physical screen pixel width >= 1.35px at zoomed out levels and >= 1.0px at all zoom levels', () => {
  const testZooms = [0.5, 0.6, 0.7, 0.72, 0.73, 0.75, 0.8, 0.9, 1.0, 1.25, 1.5, 2.0]

  for (const z of testZooms) {
    const cssBorderWidth = computeCellBorderWidth(z)
    const screenPixelWidth = cssBorderWidth * z
    const minExpected = z < 1.0 ? 1.34 : 1.0
    assert.ok(
      screenPixelWidth >= minExpected,
      `At zoom ${z}, screen pixel width was ${screenPixelWidth}px (css=${cssBorderWidth}px), which is < ${minExpected}px!`,
    )
  }
})

test('hard walls dynamically update with zoom and pan to keep elements in visible viewport', () => {
  const screenWidth = 1200
  const screenHeight = 800

  // At zoom = 1.0, pan = { x: 0, y: 0 }
  let zoom = 1.0
  let pan = { x: 0, y: 0 }
  let minVisX = (-pan.x + 16) / zoom
  let maxVisX = (screenWidth - pan.x - 16) / zoom
  assert.equal(minVisX, 16)
  assert.equal(maxVisX, 1184)

  // When panned right by 200px (pan.x = 200), visible world area shifts left: [-184, 984]
  pan = { x: 200, y: 0 }
  minVisX = (-pan.x + 16) / zoom
  maxVisX = (screenWidth - pan.x - 16) / zoom
  assert.equal(minVisX, -184)
  assert.equal(maxVisX, 984)

  // When zoomed to 2.0x, visible world width is halved (600px wide):
  zoom = 2.0
  pan = { x: 0, y: 0 }
  minVisX = (-pan.x + 16) / zoom
  maxVisX = (screenWidth - pan.x - 16) / zoom
  assert.equal(minVisX, 8)
  assert.equal(maxVisX, 592)

  // Vertical hard walls
  let minVisY = (-pan.y + 24) / zoom
  let maxVisY = (screenHeight - pan.y - 24) / zoom
  assert.equal(minVisY, 12)
  assert.equal(maxVisY, 388)

  // Elements fit in visible viewport
  const el = { initialPos: { x: 100, y: 100 }, width: 200, height: 42 }
  const minDelta = minVisX - el.initialPos.x
  const maxDelta = maxVisX - el.width - el.initialPos.x
  assert.ok(minDelta <= maxDelta)
})

test('oversized array expansion (width > visible width) can slide between screen edges without freezing or locking', () => {
  const screenWidth = 1200
  const zoom = 2.0 // visible world width = (1200 - 32) / 2 = 584px
  const pan = { x: 0, y: 0 }
  const minVisX = (-pan.x + 16) / zoom // 8px
  const maxVisX = (screenWidth - pan.x - 16) / zoom // 592px

  // Array has 25 cells: width = 25 * 42 = 1050px (> 584px visible width!)
  const el = { initialPos: { x: 100, y: 100 }, width: 1050, height: 42 }

  const bound1 = minVisX - el.initialPos.x // 8 - 100 = -92 (left edge at left wall)
  const bound2 = maxVisX - el.width - el.initialPos.x // 592 - 1050 - 100 = -558 (right edge at right wall)

  const minDeltaX = Math.min(bound1, bound2) // -558
  const maxDeltaX = Math.max(bound1, bound2) // -92

  assert.ok(minDeltaX < maxDeltaX, 'Range must not collapse: minDeltaX < maxDeltaX')
  assert.equal(minDeltaX, -558)
  assert.equal(maxDeltaX, -92)

  // Dragging right to view left edge
  const clampedAtLeft = Math.max(minDeltaX, Math.min(maxDeltaX, 200))
  assert.equal(clampedAtLeft, -92)
  assert.equal(el.initialPos.x + clampedAtLeft, 8, 'Left edge aligns with left wall')

  // Dragging left to view right edge
  const clampedAtRight = Math.max(minDeltaX, Math.min(maxDeltaX, -800))
  assert.equal(clampedAtRight, -558)
  assert.equal(el.initialPos.x + clampedAtRight + el.width, 592, 'Right edge aligns with right wall')

  // Dragging to a position in between
  const clampedMid = Math.max(minDeltaX, Math.min(maxDeltaX, -300))
  assert.equal(clampedMid, -300, 'Free movement is preserved across the entire array')
})

test('canvas and panning dimensions scale up to fit arrays expanding beyond default boundaries', () => {
  const zoom = 1.0
  const canvasPixelSize = { width: 1200, height: 800 }
  const worldDimensions = { width: 3200, height: 1800 }

  // Array expanded far to the right: x = 2800, width = 1200 => right edge = 4000 (> 3200)
  const _expandedElements = [
    { kind: 'array', position: { x: 2800, y: 200 }, values: Array(28).fill('a') }, // 28 * 42 = 1176px => 3976px
  ]

  const maxElementX = 2800 + 1176 + 100 // 4076px
  const baseW = Math.max(worldDimensions.width, maxElementX)
  const requiredW = canvasPixelSize.width / zoom

  let scaleUnits = Math.ceil(
    Math.max(
      baseW / CANVAS_ASPECT_RATIO_X,
      worldDimensions.height / CANVAS_ASPECT_RATIO_Y,
      requiredW / CANVAS_ASPECT_RATIO_X,
      canvasPixelSize.height / CANVAS_ASPECT_RATIO_Y,
    ),
  )
  if (scaleUnits % 4 !== 0) {
    scaleUnits += 4 - (scaleUnits % 4)
  }

  const expandedWorld = {
    width: scaleUnits * CANVAS_ASPECT_RATIO_X,
    height: scaleUnits * CANVAS_ASPECT_RATIO_Y,
  }

  assert.ok(
    expandedWorld.width >= 4076,
    `World width ${expandedWorld.width} must accommodate the expanded array at 4076px`,
  )
  assert.equal(
    expandedWorld.width / expandedWorld.height,
    16 / 9,
    'Expanded canvas dimensions must strictly maintain 16:9 ratio',
  )
})

const calculateAutoPanDelta = (canvasBounds, targetBounds, padding = 60) => {
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

test('auto-pan delta shifts camera left when typing or expanding cells past the right edge', () => {
  const canvasBounds = { left: 280, top: 62, right: 1280, bottom: 862, width: 1000, height: 800 }
  // Cell placed at right edge: right = 1290 (exceeds right threshold 1280 - 60 = 1220 by 70px)
  const cellBounds = { left: 1246, top: 200, right: 1290, bottom: 244, width: 44, height: 44 }

  const delta = calculateAutoPanDelta(canvasBounds, cellBounds, 60)
  assert.equal(delta.x, 70, 'deltaX must be 70px to the right so camera pan shifts left by 70px')
  assert.equal(delta.y, 0, 'deltaY should be 0 since Y is within bounds')

  // Applying delta to pan
  const currentPan = { x: 0, y: 0 }
  const nextPan = { x: currentPan.x - delta.x, y: currentPan.y - delta.y }
  assert.equal(nextPan.x, -70)
  // After moving pan by -70px, the cell right edge on screen will be 1290 - 70 = 1220 (exactly canvasBounds.right - padding)
  assert.equal(cellBounds.right + nextPan.x, canvasBounds.right - 60)
})

test('auto-pan delta shifts camera right when editing cells past the left edge', () => {
  const canvasBounds = { left: 280, top: 62, right: 1280, bottom: 862, width: 1000, height: 800 }
  // Cell placed at left: left = 300 (left threshold is 280 + 60 = 340, cell is 40px past threshold)
  const cellBounds = { left: 300, top: 200, right: 344, bottom: 244, width: 44, height: 44 }

  const delta = calculateAutoPanDelta(canvasBounds, cellBounds, 60)
  assert.equal(delta.x, -40, 'deltaX must be -40px so camera pan shifts right by 40px')
  assert.equal(delta.y, 0)

  const currentPan = { x: -200, y: 0 }
  const nextPan = { x: currentPan.x - delta.x, y: currentPan.y - delta.y }
  assert.equal(nextPan.x, -160)
})

test('auto-pan delta shifts camera up when expanding cells past the bottom edge', () => {
  const canvasBounds = { left: 280, top: 62, right: 1280, bottom: 862, width: 1000, height: 800 }
  // Bottom threshold: 862 - 60 = 802. Cell bottom = 850 (exceeds threshold by 48px)
  const cellBounds = { left: 500, top: 806, right: 544, bottom: 850, width: 44, height: 44 }

  const delta = calculateAutoPanDelta(canvasBounds, cellBounds, 60)
  assert.equal(delta.x, 0)
  assert.equal(delta.y, 48, 'deltaY must be 48px so camera pan shifts up by 48px')

  const currentPan = { x: 0, y: 0 }
  const nextPan = { x: currentPan.x - delta.x, y: currentPan.y - delta.y }
  assert.equal(nextPan.y, -48)
})

test('auto-pan delta leaves camera unchanged when cell is safely within viewport', () => {
  const canvasBounds = { left: 280, top: 62, right: 1280, bottom: 862, width: 1000, height: 800 }
  const cellBounds = { left: 500, top: 300, right: 544, bottom: 344, width: 44, height: 44 }

  const delta = calculateAutoPanDelta(canvasBounds, cellBounds, 60)
  assert.deepEqual(delta, { x: 0, y: 0 })
})

test('auto-pan delta returns (0, 0) for zero or unmeasured bounding boxes', () => {
  const zeroCanvas = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
  const cellBounds = { left: 100, top: 100, right: 144, bottom: 144, width: 44, height: 44 }

  const delta = calculateAutoPanDelta(zeroCanvas, cellBounds, 60)
  assert.deepEqual(delta, { x: 0, y: 0 })
})

test('virtual camera coordinates remain invariant when native scroll offset is strictly guarded to 0', () => {
  const canvasRect = { left: 280, top: 62 }
  const viewport = { zoom: 1.5, pan: { x: -100, y: -50 } }

  // Canvas world point
  const worldPt = { x: 400, y: 300 }

  // Screen point calculation with scrollLeft === 0
  const screenPt = {
    x: worldPt.x * viewport.zoom + viewport.pan.x + canvasRect.left,
    y: worldPt.y * viewport.zoom + viewport.pan.y + canvasRect.top,
  }

  // Hit test back to world: (screen - left - pan) / zoom
  const hitTestWorld = {
    x: (screenPt.x - canvasRect.left - viewport.pan.x) / viewport.zoom,
    y: (screenPt.y - canvasRect.top - viewport.pan.y) / viewport.zoom,
  }

  assert.equal(hitTestWorld.x, worldPt.x)
  assert.equal(hitTestWorld.y, worldPt.y)

  // Demonstrating the bug if scrollLeft were non-zero (e.g. 80px)
  const unmanagedScrollOffset = 80
  const corruptedHitTestWorldX = (screenPt.x - unmanagedScrollOffset - canvasRect.left - viewport.pan.x) / viewport.zoom
  assert.notEqual(corruptedHitTestWorldX, worldPt.x, 'Unmanaged scroll offsets corrupt hit testing')

  // With strict zero-scroll guard, scroll offset is 0, preserving perfect zoom and coordinate window
  const guardedScrollOffset = 0
  const guardedHitTestWorldX = (screenPt.x - guardedScrollOffset - canvasRect.left - viewport.pan.x) / viewport.zoom
  assert.equal(guardedHitTestWorldX, worldPt.x, 'Strict zero scroll guard preserves coordinate invariance')
})


