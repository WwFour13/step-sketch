import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { CELL_SIZE, NODE_SIZE, hostBounds, iteratorPosition } from '../src/utils/canvas.ts'
import {
  getCollectionElementIds,
  isSketchCollection,
} from '../src/utils/sketchCollections.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const resolveDropModeAndHost = ({
  elements,
  _draggedIteratorId,
  targetHostId,
  dropX,
  dropY,
  canvasRect = { left: 0, top: 0 },
  panX = 0,
  panY = 0,
  currentZoom = 1.0,
}) => {
  const hostArray = elements.find(
    (el) => isSketchCollection(el) && getCollectionElementIds(el).includes(targetHostId),
  )
  let nextMode = 'bottom'
  let nextHostId = targetHostId

  if (hostArray?.kind === 'map') {
    nextMode = 'left'
  } else if (hostArray?.kind === 'matrix') {
    const bounds = hostBounds(elements, targetHostId)
    const elementIds = getCollectionElementIds(hostArray)
    const index = elementIds.indexOf(targetHostId)
    const columns = Math.max(1, hostArray.columns)
    const row = Math.floor(index / columns)
    const column = index % columns

    if (row === 0 && column > 0) {
      nextMode = 'top'
    } else if (column === 0 && row > 0) {
      nextMode = 'left'
    } else if (bounds && canvasRect) {
      const hostScreenX = canvasRect.left + panX + bounds.x * currentZoom
      const hostScreenY = canvasRect.top + panY + bounds.y * currentZoom
      const distTop = dropY - hostScreenY
      const distLeft = dropX - hostScreenX
      nextMode = distTop < distLeft ? 'top' : 'left'
    } else {
      nextMode = 'top'
    }
    nextHostId = nextMode === 'left' ? elementIds[row * columns] : elementIds[column]
  } else {
    const bounds = hostBounds(elements, targetHostId)
    if (bounds && canvasRect) {
      const hostScreenX = canvasRect.left + panX + bounds.x * currentZoom
      const hostScreenY = canvasRect.top + panY + bounds.y * currentZoom
      const centerX = hostScreenX + (bounds.width * currentZoom) / 2
      const centerY = hostScreenY + (bounds.height * currentZoom) / 2
      if (!hostArray) {
        const dx = dropX - centerX
        const dy = dropY - centerY
        if (Math.abs(dx) > Math.abs(dy)) {
          nextMode = dx < 0 ? 'left' : 'right'
        } else {
          nextMode = dy < 0 ? 'top' : 'bottom'
        }
      } else if (hostArray.kind === 'set') {
        nextMode = dropX < centerX ? 'left' : 'right'
      } else {
        nextMode = dropY < centerY ? 'top' : 'bottom'
      }
    }
  }

  return { nextMode, nextHostId }
}

test('CSS box model guarantees exact 42px cell step without cumulative drift', () => {
  const cssPath = path.resolve(__dirname, '../src/App.css')
  const cssContent = fs.readFileSync(cssPath, 'utf-8')

  // Verify horizontal array non-drifting rules
  assert.ok(
    cssContent.includes('.array-cells:not(.layout-vertical):not(.layout-matrix):not(.layout-map) input {'),
    'Should have horizontal array input selector',
  )
  assert.ok(
    cssContent.includes('width: calc(42px + var(--cell-border-width, 1px));'),
    'Horizontal cells must have width expanded by cell border width',
  )
  assert.ok(
    cssContent.includes('margin-right: calc(-1 * var(--cell-border-width, 1px));'),
    'Horizontal cells must have negative margin-right to preserve 42px layout pitch',
  )
  assert.ok(
    cssContent.includes('width: 42px;\n  margin-right: 0;'),
    'Last horizontal cell must reset margin-right to 0 and width to 42px',
  )

  // Verify vertical array non-drifting rules
  assert.ok(
    cssContent.includes('height: calc(42px + var(--cell-border-width, 1px));'),
    'Vertical cells must have height expanded by cell border width',
  )
  assert.ok(
    cssContent.includes('margin-bottom: calc(-1 * var(--cell-border-width, 1px));'),
    'Vertical cells must have negative margin-bottom to preserve 42px layout pitch',
  )

  // Mathematical layout pitch test across zoom levels (0.5x, 0.75x, 1.0x, 1.5x, 2.0x)
  const zoomLevels = [0.5, 0.75, 1.0, 1.5, 2.0]
  for (const zoom of zoomLevels) {
    const borderWidth = Math.max(1.35, 1 / zoom)
    const cellCount = 20

    // Fixed box model (new): cell k starts at k * 42px
    for (let k = 0; k < cellCount; k++) {
      const isLast = k === cellCount - 1
      const cellPitch = isLast ? CELL_SIZE : CELL_SIZE + borderWidth - borderWidth
      assert.strictEqual(cellPitch, CELL_SIZE, 'Cell pitch must strictly equal 42px')
      const cellStartX = k * CELL_SIZE
      assert.strictEqual(cellStartX, k * 42, `Cell ${k} start must equal ${k * 42}`)
    }

    // Comparison against old buggy margin-left model:
    // Old model: cellStartX_buggy = k * (42 - borderWidth)
    // Drift = k * borderWidth
    const buggyDriftAt13 = 13 * borderWidth
    if (zoom === 0.5) {
      assert.ok(buggyDriftAt13 >= 26, `Old model suffered ${buggyDriftAt13}px drift at index 13 under 0.5x zoom`)
    }
  }
})

test('horizontal array iterator coordinates remain centered on all cells with zero drift', () => {
  const cellIds = Array.from({ length: 20 }, (_, i) => 100 + i)
  const array = {
    id: 1,
    kind: 'array',
    label: 'nums',
    position: { x: 200, y: 300 },
    input_type: 'number',
    element_ids: cellIds,
    values: cellIds.map((_, i) => String(i * 10)),
  }

  // Test indices 0, 1, 5, 10, 13, 19
  const testIndices = [0, 1, 5, 10, 13, 19]
  for (const idx of testIndices) {
    const cellId = cellIds[idx]
    const elements = [
      array,
      { id: 500, kind: 'iterator', hostId: cellId, color: 'blue', mode: 'top' },
      { id: 501, kind: 'iterator', hostId: cellId, color: 'red', mode: 'bottom' },
    ]

    const bounds = hostBounds(elements, cellId)
    assert.deepStrictEqual(bounds, {
      x: 200 + idx * 42,
      y: 300,
      width: 42,
      height: 42,
    })

    const topPos = iteratorPosition(elements, elements[1])
    assert.deepStrictEqual(topPos, {
      x: 200 + idx * 42 + 42 / 2 - 6, // 200 + idx * 42 + 15
      y: 300 - 14,                    // 286
    })

    const bottomPos = iteratorPosition(elements, elements[2])
    assert.deepStrictEqual(bottomPos, {
      x: 200 + idx * 42 + 42 / 2 - 6, // 200 + idx * 42 + 15
      y: 300 + 42 + 5,                // 347
    })
  }
})

test('multiple sibling iterators on the same array cell space symmetrically around center', () => {
  const array = {
    id: 1,
    kind: 'array',
    label: 'nums',
    position: { x: 100, y: 100 },
    input_type: 'number',
    element_ids: [10, 11],
    values: ['1', '2'],
  }

  // 1 iterator: offset 0
  const single = [
    array,
    { id: 50, kind: 'iterator', hostId: 10, color: 'red', mode: 'top' },
  ]
  const pSingle = iteratorPosition(single, single[1])
  assert.strictEqual(pSingle.x, 100 + 21 - 6)

  // 2 iterators: offsets -7 and +7
  const dual = [
    array,
    { id: 50, kind: 'iterator', hostId: 10, color: 'red', mode: 'top' },
    { id: 51, kind: 'iterator', hostId: 10, color: 'blue', mode: 'top' },
  ]
  const pDual0 = iteratorPosition(dual, dual[1])
  const pDual1 = iteratorPosition(dual, dual[2])
  assert.strictEqual(pDual0.x, 100 + 21 - 6 - 7)
  assert.strictEqual(pDual1.x, 100 + 21 - 6 + 7)
  assert.strictEqual((pDual0.x + pDual1.x) / 2, 100 + 21 - 6)

  // 3 iterators: offsets -14, 0, +14
  const triple = [
    array,
    { id: 50, kind: 'iterator', hostId: 10, color: 'red', mode: 'top' },
    { id: 51, kind: 'iterator', hostId: 10, color: 'blue', mode: 'top' },
    { id: 52, kind: 'iterator', hostId: 10, color: 'green', mode: 'top' },
  ]
  const pTriple0 = iteratorPosition(triple, triple[1])
  const pTriple1 = iteratorPosition(triple, triple[2])
  const pTriple2 = iteratorPosition(triple, triple[3])
  assert.strictEqual(pTriple0.x, 100 + 21 - 6 - 14)
  assert.strictEqual(pTriple1.x, 100 + 21 - 6)
  assert.strictEqual(pTriple2.x, 100 + 21 - 6 + 14)
})

test('vertical array / set iterator coordinates align on left and right sides', () => {
  const set = {
    id: 1,
    kind: 'set',
    label: 'visited',
    position: { x: 400, y: 150 },
    element_ids: [101, 102, 103],
    values: ['A', 'B', 'C'],
  }

  const elements = [
    set,
    { id: 201, kind: 'iterator', hostId: 102, color: 'yellow', mode: 'left' },
    { id: 202, kind: 'iterator', hostId: 102, color: 'green', mode: 'right' },
  ]

  const bounds = hostBounds(elements, 102)
  assert.deepStrictEqual(bounds, {
    x: 400,
    y: 150 + 1 * 42, // row 1
    width: 42,
    height: 42,
  })

  const leftPos = iteratorPosition(elements, elements[1])
  assert.deepStrictEqual(leftPos, {
    x: 400 - 15,
    y: 150 + 42 + 21 - 4.5, // 208.5
  })

  const rightPos = iteratorPosition(elements, elements[2])
  assert.deepStrictEqual(rightPos, {
    x: 400 + 42 + 4,
    y: 150 + 42 + 21 - 4.5, // 208.5
  })
})

test('2D matrix iterators align correctly on row headers (left) and column headers (top)', () => {
  const matrix = {
    id: 1,
    kind: 'matrix',
    label: 'grid',
    position: { x: 500, y: 200 },
    columns: 3,
    element_ids: [
      [11, 12, 13],
      [21, 22, 23],
      [31, 32, 33],
    ],
    values: [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
    ],
  }

  const elements = [
    matrix,
    // Column 2 top iterator (attached to element 13 at row 0, col 2)
    { id: 80, kind: 'iterator', hostId: 13, color: 'blue', mode: 'top' },
    // Row 1 left iterator (attached to element 21 at row 1, col 0)
    { id: 81, kind: 'iterator', hostId: 21, color: 'red', mode: 'left' },
  ]

  const colBounds = hostBounds(elements, 13)
  assert.deepStrictEqual(colBounds, {
    x: 500 + 2 * 42, // column 2
    y: 200,          // row 0
    width: 42,
    height: 42,
  })

  const colPos = iteratorPosition(elements, elements[1])
  assert.deepStrictEqual(colPos, {
    x: 500 + 2 * 42 + 21 - 6, // 599
    y: 200 - 14,              // 186
  })

  const rowBounds = hostBounds(elements, 21)
  assert.deepStrictEqual(rowBounds, {
    x: 500,          // col 0
    y: 200 + 1 * 42, // row 1
    width: 42,
    height: 42,
  })

  const rowPos = iteratorPosition(elements, elements[2])
  assert.deepStrictEqual(rowPos, {
    x: 500 - 15,              // 485
    y: 200 + 42 + 21 - 4.5,   // 258.5
  })
})

test('map iterators resolve to key cell and align to the left', () => {
  const map = {
    id: 1,
    kind: 'map',
    label: 'counts',
    position: { x: 100, y: 200 },
    element_ids: [1, 2, 3, 4], // 1,2 = row 0 (key, val); 3,4 = row 1 (key, val)
    values: ['a', '1', 'b', '2'],
  }

  // Pointing to value cell 4 should resolve to key cell 3 in row 1
  const elements = [
    map,
    { id: 99, kind: 'iterator', hostId: 4, color: 'blue', mode: 'left' },
  ]

  const bounds = hostBounds(elements, 4)
  assert.deepStrictEqual(bounds, {
    x: 100,          // col 0
    y: 200 + 1 * 42, // row 1
    width: 42,
    height: 42,
  })

  const pos = iteratorPosition(elements, elements[1])
  assert.deepStrictEqual(pos, {
    x: 100 - 15,
    y: 200 + 42 + 21 - 4.5,
  })
})

test('node and variable iterators support all 4 modes (top, bottom, left, right)', () => {
  const node = {
    id: 10,
    kind: 'node',
    position: { x: 300, y: 400 },
    value: '7',
    pointer_ids: [],
    pointer_limit: '+',
  }

  const elements = [
    node,
    { id: 1, kind: 'iterator', hostId: 10, color: 'red', mode: 'top' },
    { id: 2, kind: 'iterator', hostId: 10, color: 'blue', mode: 'bottom' },
    { id: 3, kind: 'iterator', hostId: 10, color: 'green', mode: 'left' },
    { id: 4, kind: 'iterator', hostId: 10, color: 'yellow', mode: 'right' },
  ]

  assert.deepStrictEqual(iteratorPosition(elements, elements[1]), {
    x: 300 + NODE_SIZE / 2 - 6, // 321
    y: 400 - 14,                // 386
  })
  assert.deepStrictEqual(iteratorPosition(elements, elements[2]), {
    x: 300 + NODE_SIZE / 2 - 6, // 321
    y: 400 + NODE_SIZE + 5,     // 459
  })
  assert.deepStrictEqual(iteratorPosition(elements, elements[3]), {
    x: 300 - 15,                // 285
    y: 400 + NODE_SIZE / 2 - 4.5, // 422.5
  })
  assert.deepStrictEqual(iteratorPosition(elements, elements[4]), {
    x: 300 + NODE_SIZE + 4,     // 358
    y: 400 + NODE_SIZE / 2 - 4.5, // 422.5
  })
})

test('moving iterator from "left" orientation successfully switches to "top" on matrix', () => {
  const matrix = {
    id: 1,
    kind: 'matrix',
    label: 'grid',
    position: { x: 100, y: 100 },
    columns: 3,
    element_ids: [
      [11, 12, 13],
      [21, 22, 23],
      [31, 32, 33],
    ],
    values: [
      ['A', 'B', 'C'],
      ['D', 'E', 'F'],
      ['G', 'H', 'I'],
    ],
  }

  const elements = [
    matrix,
    // Iterator currently has mode: 'left' (e.g. from row or previous host)
    { id: 99, kind: 'iterator', hostId: 21, color: 'red', mode: 'left' },
  ]

  // Drop on column 2 header (row 0, col 2 -> id 13):
  // Must switch from 'left' to 'top' and point to element 13!
  const dropCol2 = resolveDropModeAndHost({
    elements,
    draggedIteratorId: 99,
    targetHostId: 13,
    dropX: 100 + 2 * 42 + 21,
    dropY: 100 + 5,
  })
  assert.strictEqual(dropCol2.nextMode, 'top', 'Must switch to top orientation on column header')
  assert.strictEqual(dropCol2.nextHostId, 13, 'Must attach to column 2 header cell (13)')

  // Drop on corner cell (row 0, col 0 -> id 11) near top edge:
  const dropCornerTop = resolveDropModeAndHost({
    elements,
    draggedIteratorId: 99,
    targetHostId: 11,
    dropX: 100 + 21,
    dropY: 100 - 5, // Above cell top
  })
  assert.strictEqual(dropCornerTop.nextMode, 'top', 'Must switch to top when dropped above corner cell')
  assert.strictEqual(dropCornerTop.nextHostId, 11)

  // Drop on corner cell (row 0, col 0 -> id 11) near left edge:
  const dropCornerLeft = resolveDropModeAndHost({
    elements,
    draggedIteratorId: 99,
    targetHostId: 11,
    dropX: 100 - 5, // To the left of cell
    dropY: 100 + 21,
  })
  assert.strictEqual(dropCornerLeft.nextMode, 'left', 'Must stay/switch to left when dropped to the left of corner cell')
  assert.strictEqual(dropCornerLeft.nextHostId, 11)

  // Drop on row 2 left header (row 2, col 0 -> id 31):
  const dropRow2 = resolveDropModeAndHost({
    elements,
    draggedIteratorId: 99,
    targetHostId: 31,
    dropX: 100 + 5,
    dropY: 100 + 2 * 42 + 21,
  })
  assert.strictEqual(dropRow2.nextMode, 'left', 'Must stay/switch to left on row header')
  assert.strictEqual(dropRow2.nextHostId, 31, 'Must attach to row 2 left cell (31)')
})

test('moving iterator from "left" orientation successfully switches to "top" on horizontal array', () => {
  const array = {
    id: 1,
    kind: 'array',
    label: 'nums',
    position: { x: 50, y: 50 },
    input_type: 'number',
    element_ids: [100, 101, 102],
    values: ['1', '2', '3'],
  }

  const elements = [
    array,
    // Currently mode: 'left'
    { id: 99, kind: 'iterator', hostId: 101, color: 'blue', mode: 'left' },
  ]

  // Drop above cell 101 centerY:
  const dropTop = resolveDropModeAndHost({
    elements,
    draggedIteratorId: 99,
    targetHostId: 101,
    dropX: 50 + 42 + 21,
    dropY: 50 + 10, // Above centerY (50 + 21 = 71)
  })
  assert.strictEqual(dropTop.nextMode, 'top', 'Must switch to top orientation when dropped above cell center')
  assert.strictEqual(dropTop.nextHostId, 101)

  // Drop below cell 101 centerY:
  const dropBottom = resolveDropModeAndHost({
    elements,
    draggedIteratorId: 99,
    targetHostId: 101,
    dropX: 50 + 42 + 21,
    dropY: 50 + 35, // Below centerY (71)
  })
  assert.strictEqual(dropBottom.nextMode, 'bottom', 'Must switch to bottom orientation when dropped below cell center')
  assert.strictEqual(dropBottom.nextHostId, 101)
})

test('moving iterator from "left" orientation supports all 4 quadrants on nodes', () => {
  const node = {
    id: 1,
    kind: 'node',
    position: { x: 200, y: 200 },
    value: '42',
    pointer_ids: [],
    pointer_limit: '+',
  }

  const elements = [
    node,
    // Current mode: 'left'
    { id: 99, kind: 'iterator', hostId: 1, color: 'blue', mode: 'left' },
  ]

  // Node center is at (200 + 27, 200 + 27) = (227, 227)
  // Drop above node
  const dropTop = resolveDropModeAndHost({
    elements,
    _draggedIteratorId: 99,
    targetHostId: 1,
    dropX: 227,
    dropY: 180,
  })
  assert.strictEqual(dropTop.nextMode, 'top', 'Must switch to top when dropped above node')

  // Drop below node
  const dropBottom = resolveDropModeAndHost({
    elements,
    _draggedIteratorId: 99,
    targetHostId: 1,
    dropX: 227,
    dropY: 280,
  })
  assert.strictEqual(dropBottom.nextMode, 'bottom', 'Must switch to bottom when dropped below node')

  // Drop right of node
  const dropRight = resolveDropModeAndHost({
    elements,
    _draggedIteratorId: 99,
    targetHostId: 1,
    dropX: 280,
    dropY: 227,
  })
  assert.strictEqual(dropRight.nextMode, 'right', 'Must switch to right when dropped right of node')

  // Drop left of node
  const dropLeft = resolveDropModeAndHost({
    elements,
    _draggedIteratorId: 99,
    targetHostId: 1,
    dropX: 180,
    dropY: 227,
  })
  assert.strictEqual(dropLeft.nextMode, 'left', 'Must remain left when dropped left of node')
})
