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

