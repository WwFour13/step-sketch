import assert from 'node:assert/strict'
import test from 'node:test'

const isSketchCollection = (element) =>
  element.kind === 'array' ||
  element.kind === 'set' ||
  element.kind === 'map' ||
  element.kind === 'matrix'

const getCollectionElementIds = (collection) =>
  collection.kind === 'matrix' ? collection.element_ids.flat() : [...collection.element_ids]

const getHostElement = (elements, hostId) => {
  return elements.find(
    (element) =>
      element.id === hostId ||
      (isSketchCollection(element) && getCollectionElementIds(element).includes(hostId)),
  )
}

const getElementStackingLevel = (elements, elementId) => {
  const sketchElements = elements.filter((el) => el.kind !== 'iterator')
  const sketchIndex = sketchElements.findIndex((el) => el.id === elementId)
  if (sketchIndex !== -1) {
    return (sketchIndex + 1) * 10
  }

  const iterator = elements.find((el) => el.kind === 'iterator' && el.id === elementId)
  if (iterator && iterator.kind === 'iterator') {
    const host = getHostElement(elements, iterator.hostId)
    if (host) {
      return getElementStackingLevel(elements, host.id)
    }
  }

  const hostCollection = elements.find(
    (el) => isSketchCollection(el) && getCollectionElementIds(el).includes(elementId),
  )
  if (hostCollection) {
    return getElementStackingLevel(elements, hostCollection.id)
  }

  return 10
}

const bringElementsToFront = (elements, targetIds) => {
  const rawTargetSet =
    targetIds instanceof Set
      ? targetIds
      : new Set(Array.isArray(targetIds) ? targetIds : [targetIds])

  if (rawTargetSet.size === 0) return elements

  const targetSet = new Set(rawTargetSet)

  for (const element of elements) {
    if (isSketchCollection(element)) {
      const cellIds = getCollectionElementIds(element)
      if (cellIds.some((cid) => rawTargetSet.has(cid))) {
        targetSet.add(element.id)
      }
    }
  }

  for (const element of elements) {
    if (element.kind === 'iterator' && targetSet.has(element.id)) {
      const host = getHostElement(elements, element.hostId)
      if (host) {
        targetSet.add(host.id)
      }
    }
  }

  for (const element of elements) {
    if (element.kind === 'iterator') {
      const host = getHostElement(elements, element.hostId)
      if (host && targetSet.has(host.id)) {
        targetSet.add(element.id)
      }
    }
  }

  const unselectedSketch = []
  const selectedSketch = []
  const unselectedIterators = []
  const selectedIterators = []

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

test('iterators have the exact same stacking level as their host node', () => {
  const elements = [
    { id: 1, kind: 'node', value: '1' },
    { id: 2, kind: 'variable', label: 'x' },
    { id: 10, kind: 'iterator', hostId: 1 },
  ]

  const nodeLevel = getElementStackingLevel(elements, 1)
  const varLevel = getElementStackingLevel(elements, 2)
  const iterLevel = getElementStackingLevel(elements, 10)

  assert.equal(nodeLevel, 10)
  assert.equal(varLevel, 20)
  assert.equal(iterLevel, nodeLevel, 'Iterator must share its host node level')
})

test('iterators have the exact same stacking level as their host array cell', () => {
  const elements = [
    { id: 1, kind: 'node', value: '1' },
    { id: 2, kind: 'array', values: ['a', 'b'], element_ids: [101, 102] },
    { id: 3, kind: 'variable', label: 'z' },
    { id: 20, kind: 'iterator', hostId: 102 },
  ]

  const arrayLevel = getElementStackingLevel(elements, 2)
  const iterLevel = getElementStackingLevel(elements, 20)

  assert.equal(arrayLevel, 20)
  assert.equal(iterLevel, arrayLevel, 'Iterator on cell 102 must have level of parent array')
})

test('pointer arrows have the same stacking level as their lowest edge node', () => {
  const elements = [
    { id: 1, kind: 'node', value: '1', pointer_ids: [3] },
    { id: 2, kind: 'array', values: ['mid'], element_ids: [100] },
    { id: 3, kind: 'node', value: '3', pointer_ids: [] },
  ]

  const sourceLevel = getElementStackingLevel(elements, 1)
  const arrayLevel = getElementStackingLevel(elements, 2)
  const targetLevel = getElementStackingLevel(elements, 3)

  assert.equal(sourceLevel, 10)
  assert.equal(arrayLevel, 20)
  assert.equal(targetLevel, 30)

  const pointerLevel = Math.min(sourceLevel, targetLevel)
  assert.equal(pointerLevel, 10, 'Pointer arrow must have level of lowest edge node (Node 1)')
  assert.ok(
    pointerLevel < arrayLevel,
    'Pointer arrow (level 10) must be below intermediate Array 2 (level 20)',
  )
})

test('pointer arrow level is determined by the lowest edge node', () => {
  const elements = [
    { id: 1, kind: 'node', value: '1', pointer_ids: [2] },
    { id: 2, kind: 'node', value: '2', pointer_ids: [] },
    { id: 3, kind: 'array', values: ['mid'], element_ids: [100] },
  ]

  // Initially: Node 1 (10), Node 2 (20), Array 3 (30)
  // Arrow (1 -> 2) has min(10, 20) = 10, which is below Array 3 (30)
  let pLevel = Math.min(
    getElementStackingLevel(elements, 1),
    getElementStackingLevel(elements, 2),
  )
  assert.equal(pLevel, 10)
  assert.ok(pLevel < getElementStackingLevel(elements, 3))

  // Bring both edge nodes above Array 3
  const reordered = bringElementsToFront(elements, [1, 2])
  // New order: Array 3 (10), Node 1 (20), Node 2 (30)
  assert.equal(getElementStackingLevel(reordered, 3), 10)
  assert.equal(getElementStackingLevel(reordered, 1), 20)
  assert.equal(getElementStackingLevel(reordered, 2), 30)

  // Arrow (1 -> 2) now has min(20, 30) = 20, which is now ABOVE Array 3 (10)!
  pLevel = Math.min(
    getElementStackingLevel(reordered, 1),
    getElementStackingLevel(reordered, 2),
  )
  assert.equal(pLevel, 20)
  assert.ok(
    pLevel > getElementStackingLevel(reordered, 3),
    'Pointer arrow is now above Array 3 because lowest edge node (Node 1 at level 20) is above Array 3',
  )
})

test('selecting an array brings both the array and its iterators to the front together', () => {
  const elements = [
    { id: 1, kind: 'array', values: ['x'], element_ids: [10] },
    { id: 2, kind: 'node', value: '2' },
    { id: 100, kind: 'iterator', hostId: 10 },
  ]

  // Initially: Array 1 has level 10, Node 2 has level 20, Iterator 100 has level 10
  assert.equal(getElementStackingLevel(elements, 1), 10)
  assert.equal(getElementStackingLevel(elements, 100), 10)
  assert.equal(getElementStackingLevel(elements, 2), 20)

  // Bring Array 1 to front
  const reordered = bringElementsToFront(elements, 1)
  assert.equal(getElementStackingLevel(reordered, 2), 10)
  assert.equal(getElementStackingLevel(reordered, 1), 20)
  assert.equal(getElementStackingLevel(reordered, 100), 20)
  assert.ok(
    getElementStackingLevel(reordered, 100) > getElementStackingLevel(reordered, 2),
    'Iterator on Array 1 is now above Node 2 because Array 1 was brought to front',
  )
})

test('bringElementsToFront preserves relative order when multiple elements are selected', () => {
  const elements = [
    { id: 1, kind: 'node', value: '1' },
    { id: 2, kind: 'variable', label: 'x' },
    { id: 3, kind: 'node', value: '3' },
    { id: 4, kind: 'variable', label: 'y' },
  ]

  const reordered = bringElementsToFront(elements, [1, 3])
  assert.deepEqual(
    reordered.map((el) => el.id),
    [2, 4, 1, 3],
  )
})

test('bringElementsToFront resolves cell ID to parent collection and elevates it', () => {
  const elements = [
    { id: 1, kind: 'array', values: ['a', 'b'], element_ids: [101, 102] },
    { id: 2, kind: 'node', value: '2' },
  ]

  const reordered = bringElementsToFront(elements, 102)
  assert.deepEqual(
    reordered.map((el) => el.id),
    [2, 1],
  )
})
