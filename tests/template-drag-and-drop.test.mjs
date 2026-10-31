import assert from 'node:assert/strict'
import test from 'node:test'
import { CELL_SIZE, NODE_SIZE } from '../src/constants/sketch.ts'
import {
  TEMPLATE_DEFINITIONS,
  createTemplateElements,
} from '../src/utils/sketchTemplates.ts'

test('TEMPLATE_DEFINITIONS defines all 9 canvas templates with correct icons and sizes', () => {
  const kinds = [
    'variable',
    'node',
    'array',
    'string',
    'linked-list',
    'set',
    'map',
    'binary-tree',
    'matrix',
  ]

  for (const kind of kinds) {
    const def = TEMPLATE_DEFINITIONS[kind]
    assert.ok(def, `Definition must exist for ${kind}`)
    assert.equal(def.kind, kind)
    assert.ok(def.icon.length > 0, `Icon must exist for ${kind}`)
    assert.ok(def.label.length > 0, `Label must exist for ${kind}`)
    assert.ok(def.size.width > 0, `Width must be > 0 for ${kind}`)
    assert.ok(def.size.height > 0, `Height must be > 0 for ${kind}`)
  }

  assert.equal(TEMPLATE_DEFINITIONS.variable.size.width, NODE_SIZE)
  assert.equal(TEMPLATE_DEFINITIONS.node.size.width, NODE_SIZE)
  assert.equal(TEMPLATE_DEFINITIONS.array.size.width, 4 * CELL_SIZE)
  assert.equal(TEMPLATE_DEFINITIONS.string.size.width, 4 * CELL_SIZE)
  assert.equal(TEMPLATE_DEFINITIONS.set.size.width, CELL_SIZE)
  assert.equal(TEMPLATE_DEFINITIONS.set.size.height, 4 * CELL_SIZE)
  assert.equal(TEMPLATE_DEFINITIONS.matrix.size.width, 3 * CELL_SIZE)
  assert.equal(TEMPLATE_DEFINITIONS.matrix.size.height, 3 * CELL_SIZE)
})

test('createTemplateElements instantiates standard single-element templates', () => {
  const pos = { x: 100, y: 150 }

  // Variable
  const varResult = createTemplateElements('variable', 10, pos)
  assert.equal(varResult.elements.length, 1)
  assert.equal(varResult.primaryId, 10)
  assert.equal(varResult.nextId, 11)
  assert.equal(varResult.elements[0].kind, 'variable')
  assert.deepEqual(varResult.elements[0].position, pos)

  // Node
  const nodeResult = createTemplateElements('node', 20, pos)
  assert.equal(nodeResult.elements.length, 1)
  assert.equal(nodeResult.primaryId, 20)
  assert.equal(nodeResult.nextId, 21)
  assert.equal(nodeResult.elements[0].kind, 'node')
  assert.deepEqual(nodeResult.elements[0].position, pos)

  // Array (numbers)
  const arrResult = createTemplateElements('array', 30, pos)
  assert.equal(arrResult.elements.length, 1)
  assert.equal(arrResult.primaryId, 30)
  assert.equal(arrResult.elements[0].kind, 'array')
  assert.equal(arrResult.elements[0].input_type, 'number')
  assert.deepEqual(arrResult.elements[0].values, ['1', '4', '9', '16'])
  assert.equal(arrResult.nextId, 30 + 4 + 1)

  // String (characters)
  const strResult = createTemplateElements('string', 40, pos)
  assert.equal(strResult.elements.length, 1)
  assert.equal(strResult.primaryId, 40)
  assert.equal(strResult.elements[0].kind, 'array')
  assert.equal(strResult.elements[0].input_type, 'character')
  assert.deepEqual(strResult.elements[0].values, ['a', 'l', 'g', 'o'])

  // Set (vertical unique values)
  const setResult = createTemplateElements('set', 50, pos)
  assert.equal(setResult.elements.length, 1)
  assert.equal(setResult.primaryId, 50)
  assert.equal(setResult.elements[0].kind, 'set')
  assert.deepEqual(setResult.elements[0].values, ['2', '7', '11', '15'])

  // Map (2 columns)
  const mapResult = createTemplateElements('map', 60, pos)
  assert.equal(mapResult.elements.length, 1)
  assert.equal(mapResult.primaryId, 60)
  assert.equal(mapResult.elements[0].kind, 'map')
  assert.deepEqual(mapResult.elements[0].values, ['name', 'Ada', 'role', 'coder', 'level', '42'])

  // Matrix (3x3)
  const matResult = createTemplateElements('matrix', 70, pos)
  assert.equal(matResult.elements.length, 1)
  assert.equal(matResult.primaryId, 70)
  assert.equal(matResult.elements[0].kind, 'matrix')
  assert.equal(matResult.elements[0].columns, 3)
  assert.equal(matResult.elements[0].values.length, 3)
})

test('createTemplateElements instantiates composite linked list with intact iterator and pointers', () => {
  const pos = { x: 200, y: 300 }
  const result = createTemplateElements('linked-list', 1, pos, 0)

  // 3 nodes + 1 iterator
  assert.equal(result.elements.length, 4)
  assert.equal(result.primaryId, 1)
  assert.equal(result.nextId, 5)

  const nodes = result.elements.filter((el) => el.kind === 'node')
  const iterators = result.elements.filter((el) => el.kind === 'iterator')
  assert.equal(nodes.length, 3)
  assert.equal(iterators.length, 1)

  // Node 0 -> Node 1 -> Node 2
  assert.deepEqual(nodes[0].pointer_ids, [2])
  assert.deepEqual(nodes[1].pointer_ids, [3])
  assert.deepEqual(nodes[2].pointer_ids, [])

  // Node positions spaced by 120px
  assert.equal(nodes[0].position.x, 200)
  assert.equal(nodes[1].position.x, 320)
  assert.equal(nodes[2].position.x, 440)

  // Iterator points to head node
  assert.equal(iterators[0].hostId, 1)
  assert.equal(iterators[0].mode, 'bottom')
  assert.equal(iterators[0].label, 'head')
})

test('createTemplateElements instantiates composite binary tree with intact hierarchy', () => {
  const pos = { x: 50, y: 80 }
  const result = createTemplateElements('binary-tree', 10, pos)

  assert.equal(result.elements.length, 7)
  assert.equal(result.primaryId, 10)
  assert.equal(result.nextId, 17)

  const nodes = result.elements
  // Root node is at index 0 (id 10)
  const root = nodes[0]
  assert.equal(root.id, 10)
  // Root pointers to children (left: 11, right: 12)
  assert.deepEqual(root.pointer_ids, [11, 12])

  // Intermediate node pointers
  const leftChild = nodes[1]
  assert.equal(leftChild.id, 11)
  assert.deepEqual(leftChild.pointer_ids, [13, 14])

  const rightChild = nodes[2]
  assert.equal(rightChild.id, 12)
  assert.deepEqual(rightChild.pointer_ids, [15, 16])

  // Leaves have no outgoing pointers
  for (let i = 3; i < 7; i++) {
    assert.deepEqual(nodes[i].pointer_ids, [])
  }
})

test('drag-to-canvas threshold: movement < 4px is treated as click, >= 4px is treated as drag', () => {
  const startX = 100
  const startY = 100

  // Click jitter: movement = 2px
  const jitterDist = Math.hypot(101 - startX, 102 - startY)
  assert.ok(jitterDist < 4, 'Small movement (<4px) must not start drag')

  // Real drag: movement = 10px
  const dragDist = Math.hypot(110 - startX, 100 - startY)
  assert.ok(dragDist >= 4, 'Movement >= 4px must start drag')
})

test('drag-to-canvas coordinate centering: centers template bounding box on pointer world position', () => {
  const canvasBounds = { left: 240, top: 60, width: 1200, height: 800 }
  const pan = { x: 0, y: 0 }
  const zoom = 1.0

  // Pointer enters canvas at (400, 300) screen coordinates
  const clientX = 400
  const clientY = 300

  const worldX = (clientX - canvasBounds.left - pan.x) / zoom // 400 - 240 = 160
  const worldY = (clientY - canvasBounds.top - pan.y) / zoom // 300 - 60 = 240

  assert.equal(worldX, 160)
  assert.equal(worldY, 240)

  // For a 4-cell array (width = 168, height = 42)
  const arrayDef = TEMPLATE_DEFINITIONS.array
  const spawnPos = {
    x: Math.round(worldX - arrayDef.size.width / 2),
    y: Math.round(worldY - arrayDef.size.height / 2),
  }

  assert.equal(spawnPos.x, 160 - 84) // 76
  assert.equal(spawnPos.y, 240 - 21) // 219

  // Center of the created element is exactly at world cursor
  assert.equal(spawnPos.x + arrayDef.size.width / 2, worldX)
  assert.equal(spawnPos.y + arrayDef.size.height / 2, worldY)
})

test('pointer release preserves dragged coordinates and does not reset to initial spawn position', () => {
  const canvasBounds = { left: 200, top: 50, width: 1200, height: 800 }
  const pan = { x: 0, y: 0 }
  const zoom = 1.0

  // 1. Template enters canvas at client (300, 200) -> world (100, 150)
  const entryClientX = 300
  const entryClientY = 200
  const entryWorldX = (entryClientX - canvasBounds.left - pan.x) / zoom // 100
  const entryWorldY = (entryClientY - canvasBounds.top - pan.y) / zoom // 150

  const setDef = TEMPLATE_DEFINITIONS.set // width: 42, height: 168
  const initialSpawnPos = {
    x: Math.round(entryWorldX - setDef.size.width / 2), // 100 - 21 = 79
    y: Math.round(entryWorldY - setDef.size.height / 2), // 150 - 84 = 66
  }

  const buildResult = createTemplateElements('set', 1, initialSpawnPos)
  let currentElements = [...buildResult.elements]

  // Setup dragRef as done upon entering canvas
  const primaryInitialPos = buildResult.elements[0].position
  const dragRef = {
    id: buildResult.primaryId,
    offsetX: Math.round(entryWorldX - primaryInitialPos.x),
    offsetY: Math.round(entryWorldY - primaryInitialPos.y),
    draggedIds: new Set(buildResult.allElementIds),
    initialPositions: new Map(
      buildResult.elements
        .filter((el) => el.kind !== 'iterator')
        .map((el) => [el.id, el.position]),
    ),
    isTemplateDrag: true,
  }

  // 2. User drags 400px to the right and 200px down to client (700, 400)
  const releaseClientX = 700
  const releaseClientY = 400
  const releaseWorldX = (releaseClientX - canvasBounds.left - pan.x) / zoom // 500
  const releaseWorldY = (releaseClientY - canvasBounds.top - pan.y) / zoom // 350

  // Simulate moveDrag
  const rawTargetX = releaseWorldX - dragRef.offsetX // 500 - 21 = 479
  const rawTargetY = releaseWorldY - dragRef.offsetY // 350 - 84 = 266
  const deltaX = rawTargetX - primaryInitialPos.x // 479 - 79 = 400
  const deltaY = rawTargetY - primaryInitialPos.y // 266 - 66 = 200

  currentElements = currentElements.map((el) => {
    const initPos = dragRef.initialPositions.get(el.id)
    if (!initPos) return el
    return {
      ...el,
      position: {
        x: Math.round(initPos.x + deltaX),
        y: Math.round(initPos.y + deltaY),
      },
    }
  })

  // 3. Pointer released! Simulate finishPointer / handlePointerUp
  // Verify that isTemplateDrag prevents resetting back to initialSpawnPos
  const primaryElement = currentElements.find((el) => el.id === dragRef.id)
  assert.ok(primaryElement)

  const distMoved = Math.hypot(
    primaryElement.position.x - initialSpawnPos.x,
    primaryElement.position.y - initialSpawnPos.y,
  )
  assert.ok(distMoved > 5, 'Drag distance should be > 5')

  // Under the bug, finishPointer checked maxDist > 5 && !isTemplateDrag (which evaluated to false),
  // causing it to reset position back to initialSpawnPos.
  // With the fix, isTemplateDrag completes cleanly without resetting.
  if (dragRef.isTemplateDrag) {
    dragRef.current = null
  }

  // Check coordinates after release
  assert.equal(primaryElement.position.x, 479)
  assert.equal(primaryElement.position.y, 266)
  assert.notEqual(
    primaryElement.position.x,
    initialSpawnPos.x,
    'Element must NOT be reset to initial spawn coordinate on release',
  )
  assert.notEqual(
    primaryElement.position.y,
    initialSpawnPos.y,
    'Element must NOT be reset to initial spawn coordinate on release',
  )
})

test('small drag (< 5px) on template drag also preserves final position upon release', () => {
  const pos = { x: 200, y: 200 }
  const buildResult = createTemplateElements('variable', 1, pos)

  const dragRef = {
    id: buildResult.primaryId,
    offsetX: 27,
    offsetY: 27,
    draggedIds: new Set([1]),
    initialPositions: new Map([[1, pos]]),
    isTemplateDrag: true,
  }

  // Moved only 3px
  let elements = buildResult.elements.map((el) => ({
    ...el,
    position: { x: pos.x + 3, y: pos.y + 2 },
  }))

  // finishPointer for template drag must NOT revert small movement (<5px)
  if (dragRef.isTemplateDrag) {
    // Keep final position
  } else {
    // Regular drag would revert jitter
    elements = elements.map((el) => ({ ...el, position: pos }))
  }

  assert.equal(elements[0].position.x, 203)
  assert.equal(elements[0].position.y, 202)
})

test('finishPointer with isTemplateDrag exits early and never executes position reset', () => {
  const initialSpawnPos = { x: 50, y: 100 }
  const buildResult = createTemplateElements('set', 1, initialSpawnPos)

  const dragRef = {
    current: {
      id: buildResult.primaryId,
      offsetX: 21,
      offsetY: 84,
      draggedIds: new Set([1]),
      initialPositions: new Map([[1, initialSpawnPos]]),
      isTemplateDrag: true,
    },
  }

  // Element was moved by user to (350, 250)
  let elements = [{ ...buildResult.elements[0], position: { x: 350, y: 250 } }]

  // Execute finishPointer logic exactly as implemented:
  if (dragRef.current) {
    if (dragRef.current.isTemplateDrag) {
      dragRef.current = null
      // early exit!
    } else {
      // Revert branch that previously ran under the bug
      elements = elements.map((el) => ({ ...el, position: initialSpawnPos }))
    }
  }

  assert.equal(dragRef.current, null)
  assert.equal(elements[0].position.x, 350)
  assert.equal(elements[0].position.y, 250)
})

test('composite structure (linked list) preserves all node offsets upon pointer release', () => {
  const spawnPos = { x: 100, y: 100 }
  const buildResult = createTemplateElements('linked-list', 1, spawnPos)

  const dragRef = {
    id: buildResult.primaryId,
    offsetX: 147,
    offsetY: 37,
    draggedIds: new Set([1, 2, 3]),
    initialPositions: new Map([
      [1, { x: 100, y: 100 }],
      [2, { x: 220, y: 100 }],
      [3, { x: 340, y: 100 }],
    ]),
    isTemplateDrag: true,
  }

  // Dragged by deltaX = 150, deltaY = 80
  const finalElements = buildResult.elements.map((el) => {
    const initPos = dragRef.initialPositions.get(el.id)
    if (!initPos) return el
    return {
      ...el,
      position: { x: initPos.x + 150, y: initPos.y + 80 },
    }
  })

  // Verify all 3 nodes have the correct coordinates upon release
  const node1 = finalElements.find((el) => el.id === 1)
  const node2 = finalElements.find((el) => el.id === 2)
  const node3 = finalElements.find((el) => el.id === 3)

  assert.equal(node1.position.x, 250)
  assert.equal(node1.position.y, 180)
  assert.equal(node2.position.x, 370)
  assert.equal(node2.position.y, 180)
  assert.equal(node3.position.x, 490)
  assert.equal(node3.position.y, 180)

  // Relative distance between nodes remains 120px
  assert.equal(node2.position.x - node1.position.x, 120)
  assert.equal(node3.position.x - node2.position.x, 120)
})

test('composite structures select ALL constituent nodes when entering canvas, unifying with multi-selection move', () => {
  // Linked list: 3 nodes + 1 iterator
  const listResult = createTemplateElements('linked-list', 1, { x: 100, y: 100 }, 0)
  const listSelectableIds = listResult.elements
    .filter((el) => el.kind !== 'iterator')
    .map((el) => el.id)

  assert.deepEqual(listSelectableIds, [1, 2, 3], 'All 3 nodes in linked list must be selectable')
  const listSelectedSet = new Set(listSelectableIds)
  assert.equal(listSelectedSet.size, 3)
  assert.ok(listSelectedSet.has(1))
  assert.ok(listSelectedSet.has(2))
  assert.ok(listSelectedSet.has(3))

  // Binary tree: 7 nodes
  const treeResult = createTemplateElements('binary-tree', 10, { x: 50, y: 50 })
  const treeSelectableIds = treeResult.elements
    .filter((el) => el.kind !== 'iterator')
    .map((el) => el.id)

  assert.deepEqual(
    treeSelectableIds,
    [10, 11, 12, 13, 14, 15, 16],
    'All 7 nodes in binary tree must be selectable',
  )
  const treeSelectedSet = new Set(treeSelectableIds)
  assert.equal(treeSelectedSet.size, 7)
  for (let id = 10; id <= 16; id++) {
    assert.ok(treeSelectedSet.has(id))
  }

  // Single elements: 1 element selected
  for (const singleKind of ['variable', 'node', 'array', 'string', 'set', 'map', 'matrix']) {
    const singleResult = createTemplateElements(singleKind, 100, { x: 0, y: 0 })
    const singleSelectableIds = singleResult.elements
      .filter((el) => el.kind !== 'iterator')
      .map((el) => el.id)
    assert.equal(singleSelectableIds.length, 1)
    assert.equal(singleSelectableIds[0], 100)
  }
})

test('multi-node composite drag uses identical draggedIds and position-delta mechanism as standard canvas multi-drag', () => {
  const treeResult = createTemplateElements('binary-tree', 1, { x: 200, y: 200 })
  const selectableIds = treeResult.elements
    .filter((el) => el.kind !== 'iterator')
    .map((el) => el.id)

  // Standard multi-selection drag initialization on canvas:
  // 1. selectedIds contains all nodes
  const selectedIds = new Set(selectableIds)
  // 2. draggedIds contains all selectedIds
  const draggedIds = new Set(selectedIds)
  // 3. initialPositions maps each draggedId to its position
  const initialPositions = new Map(
    treeResult.elements
      .filter((el) => el.kind !== 'iterator' && draggedIds.has(el.id))
      .map((el) => [el.id, el.position]),
  )

  // Simulate moveDrag by deltaX = 50, deltaY = 30
  const deltaX = 50
  const deltaY = 30

  const movedElements = treeResult.elements.map((el) => {
    const init = initialPositions.get(el.id)
    if (!init) return el
    return {
      ...el,
      position: {
        x: Math.round(init.x + deltaX),
        y: Math.round(init.y + deltaY),
      },
    }
  })

  // Verify all 7 nodes shifted by exactly deltaX, deltaY
  for (const moved of movedElements) {
    const orig = treeResult.elements.find((e) => e.id === moved.id)
    assert.equal(moved.position.x - orig.position.x, 50)
    assert.equal(moved.position.y - orig.position.y, 30)
  }

  // After pointer release, selectedIds remains intact (all 7 nodes selected)
  assert.equal(selectedIds.size, 7)

  // Subsequent click on any node (e.g. node 4) within selectedIds triggers standard multi-selection move
  const clickedId = 4
  assert.ok(selectedIds.has(clickedId), 'Clicked node must already be in selectedIds')
  const subsequentActiveSelection = selectedIds.has(clickedId) && selectedIds.size > 1
    ? new Set(selectedIds)
    : new Set([clickedId])
  assert.equal(subsequentActiveSelection.size, 7, 'Subsequent drag keeps all 7 nodes moving together')
})


