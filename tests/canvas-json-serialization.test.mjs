import assert from 'node:assert/strict'
import test from 'node:test'

const DEFAULT_CANVAS_DIMENSIONS = {
  width: 3200,
  height: 1800,
}

const DEFAULT_CANVAS_VIEWPORT = {
  zoom: 1,
  pan: { x: 0, y: 0 },
}

const MIN_CANVAS_ZOOM = 0.5
const MAX_CANVAS_ZOOM = 2.0

const serializeCanvasState = (state) => {
  return JSON.stringify(state, null, 2)
}

const validateCanvasState = (data) => {
  if (!data || typeof data !== 'object') return null

  const candidate = data

  let doc = candidate.document
  let vp = candidate.viewport

  if (!doc && Array.isArray(candidate.elements)) {
    doc = candidate
    vp = DEFAULT_CANVAS_VIEWPORT
  }

  if (!doc || typeof doc !== 'object') return null
  const docObj = doc

  if (!Array.isArray(docObj.elements)) return null

  for (const el of docObj.elements) {
    if (!el || typeof el !== 'object') return null
    if (typeof el.id !== 'number' || typeof el.kind !== 'string') return null
    if (!el.position || typeof el.position !== 'object') return null
    if (typeof el.position.x !== 'number' || typeof el.position.y !== 'number') return null
  }

  const maxElementId = docObj.elements.reduce((max, el) => {
    return Math.max(max, el.id)
  }, 0)
  const nextId =
    typeof docObj.nextId === 'number' && docObj.nextId > maxElementId
      ? docObj.nextId
      : maxElementId + 1

  const dims = docObj.dimensions
  const width =
    typeof dims?.width === 'number' && dims.width > 0
      ? dims.width
      : DEFAULT_CANVAS_DIMENSIONS.width
  const height =
    typeof dims?.height === 'number' && dims.height > 0
      ? dims.height
      : DEFAULT_CANVAS_DIMENSIONS.height

  const validatedDocument = {
    version: 1,
    dimensions: { width, height },
    nextId,
    elements: docObj.elements,
  }

  const vpObj = vp && typeof vp === 'object' ? vp : null
  const rawZoom = typeof vpObj?.zoom === 'number' ? vpObj.zoom : 1
  const zoom = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, rawZoom))
  const panObj = vpObj?.pan && typeof vpObj.pan === 'object' ? vpObj.pan : null
  const pan = {
    x: typeof panObj?.x === 'number' ? panObj.x : 0,
    y: typeof panObj?.y === 'number' ? panObj.y : 0,
  }

  return {
    document: validatedDocument,
    viewport: { zoom, pan },
  }
}

test('serializeCanvasState formats complete CanvasState with document and camera viewport', () => {
  const sampleState = {
    document: {
      version: 1,
      dimensions: { width: 3200, height: 1800 },
      nextId: 5,
      elements: [
        { id: 1, kind: 'variable', name: 'x', value: '42', position: { x: 100, y: 150 } },
      ],
    },
    viewport: {
      zoom: 1.25,
      pan: { x: -50, y: -20 },
    },
  }

  const serialized = serializeCanvasState(sampleState)
  assert.ok(typeof serialized === 'string')
  const reparsed = JSON.parse(serialized)
  assert.deepEqual(reparsed, sampleState)
})

test('validateCanvasState accepts valid full CanvasState and preserves values', () => {
  const rawData = {
    document: {
      version: 1,
      dimensions: { width: 3200, height: 1800 },
      nextId: 10,
      elements: [
        { id: 1, kind: 'array', values: ['1', '2', '3'], element_ids: [2, 3, 4], position: { x: 200, y: 300 } },
      ],
    },
    viewport: {
      zoom: 1.5,
      pan: { x: -120, y: -40 },
    },
  }

  const validated = validateCanvasState(rawData)
  assert.ok(validated !== null)
  assert.equal(validated.document.nextId, 10)
  assert.equal(validated.document.elements.length, 1)
  assert.equal(validated.viewport.zoom, 1.5)
  assert.equal(validated.viewport.pan.x, -120)
})

test('validateCanvasState accepts standalone CanvasDocument and provides default viewport', () => {
  const standaloneDoc = {
    version: 1,
    dimensions: { width: 3200, height: 1800 },
    nextId: 3,
    elements: [
      { id: 1, kind: 'node', value: 'head', position: { x: 50, y: 80 } },
    ],
  }

  const validated = validateCanvasState(standaloneDoc)
  assert.ok(validated !== null)
  assert.equal(validated.document.elements.length, 1)
  assert.equal(validated.viewport.zoom, 1.0)
  assert.deepEqual(validated.viewport.pan, { x: 0, y: 0 })
})

test('validateCanvasState clamps out-of-range zoom levels to min and max boundaries', () => {
  const stateWithExtremeZoom = {
    document: {
      version: 1,
      elements: [{ id: 1, kind: 'node', position: { x: 0, y: 0 } }],
    },
    viewport: {
      zoom: 99.0, // Exceeds max 2.0
      pan: { x: 0, y: 0 },
    },
  }

  const validated = validateCanvasState(stateWithExtremeZoom)
  assert.ok(validated !== null)
  assert.equal(validated.viewport.zoom, MAX_CANVAS_ZOOM)

  const stateWithLowZoom = {
    document: {
      version: 1,
      elements: [{ id: 1, kind: 'node', position: { x: 0, y: 0 } }],
    },
    viewport: {
      zoom: 0.05, // Below min 0.5
      pan: { x: 0, y: 0 },
    },
  }

  const validatedLow = validateCanvasState(stateWithLowZoom)
  assert.ok(validatedLow !== null)
  assert.equal(validatedLow.viewport.zoom, MIN_CANVAS_ZOOM)
})

test('validateCanvasState derives nextId if missing or lower than max element id', () => {
  const stateWithMissingNextId = {
    document: {
      version: 1,
      elements: [
        { id: 14, kind: 'node', position: { x: 10, y: 10 } },
        { id: 7, kind: 'variable', position: { x: 20, y: 20 } },
      ],
    },
  }

  const validated = validateCanvasState(stateWithMissingNextId)
  assert.ok(validated !== null)
  assert.equal(validated.document.nextId, 15, 'nextId should safely be derived as maxId + 1 (14 + 1 = 15)')
})

test('validateCanvasState rejects malformed payloads and invalid element shapes', () => {
  assert.equal(validateCanvasState(null), null)
  assert.equal(validateCanvasState('not an object'), null)
  assert.equal(validateCanvasState({}), null)
  assert.equal(validateCanvasState({ document: { elements: 'not an array' } }), null)

  // Element missing required position.y
  const invalidElement = {
    document: {
      elements: [{ id: 1, kind: 'node', position: { x: 10 } }],
    },
  }
  assert.equal(validateCanvasState(invalidElement), null)

  // Element with non-number ID
  const invalidId = {
    document: {
      elements: [{ id: 'one', kind: 'node', position: { x: 10, y: 10 } }],
    },
  }
  assert.equal(validateCanvasState(invalidId), null)
})

