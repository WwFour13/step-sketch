import assert from 'node:assert/strict'
import test from 'node:test'

const getRecursiveChildNodeIds = (nodeId, elements) => {
  const root = elements.find((item) => item.id === nodeId)
  if (root?.kind !== 'node') {
    return new Set()
  }

  const result = new Set([nodeId])
  const queue = [nodeId]

  while (queue.length > 0) {
    const currentId = queue.shift()
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

test('getRecursiveChildNodeIds selects complete binary tree when root is clicked', () => {
  // Tree structure:
  //         1
  //       /   \
  //      2     3
  //     / \   / \
  //    4   5 6   7
  const elements = [
    { id: 1, kind: 'node', value: '1', pointer_ids: [2, 3] },
    { id: 2, kind: 'node', value: '2', pointer_ids: [4, 5] },
    { id: 3, kind: 'node', value: '3', pointer_ids: [6, 7] },
    { id: 4, kind: 'node', value: '4', pointer_ids: [] },
    { id: 5, kind: 'node', value: '5', pointer_ids: [] },
    { id: 6, kind: 'node', value: '6', pointer_ids: [] },
    { id: 7, kind: 'node', value: '7', pointer_ids: [] },
  ]

  const selected = getRecursiveChildNodeIds(1, elements)
  assert.deepEqual(Array.from(selected).sort(), [1, 2, 3, 4, 5, 6, 7])
})

test('getRecursiveChildNodeIds selects only branch subtree when intermediate node is clicked', () => {
  const elements = [
    { id: 1, kind: 'node', value: '1', pointer_ids: [2, 3] },
    { id: 2, kind: 'node', value: '2', pointer_ids: [4, 5] },
    { id: 3, kind: 'node', value: '3', pointer_ids: [6, 7] },
    { id: 4, kind: 'node', value: '4', pointer_ids: [] },
    { id: 5, kind: 'node', value: '5', pointer_ids: [] },
    { id: 6, kind: 'node', value: '6', pointer_ids: [] },
    { id: 7, kind: 'node', value: '7', pointer_ids: [] },
  ]

  const selectedLeft = getRecursiveChildNodeIds(2, elements)
  assert.deepEqual(Array.from(selectedLeft).sort(), [2, 4, 5])

  const selectedRight = getRecursiveChildNodeIds(3, elements)
  assert.deepEqual(Array.from(selectedRight).sort(), [3, 6, 7])
})

test('getRecursiveChildNodeIds selects only itself for a leaf node', () => {
  const elements = [
    { id: 1, kind: 'node', value: '1', pointer_ids: [2] },
    { id: 2, kind: 'node', value: '2', pointer_ids: [] },
  ]

  const selected = getRecursiveChildNodeIds(2, elements)
  assert.deepEqual(Array.from(selected), [2])
})

test('getRecursiveChildNodeIds handles cycles safely without infinite loop', () => {
  // Cycle: 1 -> 2 -> 3 -> 1
  const elements = [
    { id: 1, kind: 'node', value: '1', pointer_ids: [2] },
    { id: 2, kind: 'node', value: '2', pointer_ids: [3] },
    { id: 3, kind: 'node', value: '3', pointer_ids: [1] },
  ]

  const selected = getRecursiveChildNodeIds(1, elements)
  assert.deepEqual(Array.from(selected).sort(), [1, 2, 3])
})

test('getRecursiveChildNodeIds handles diamond DAGs without duplicate IDs', () => {
  // Diamond: 1 -> 2, 3; 2 -> 4; 3 -> 4
  const elements = [
    { id: 1, kind: 'node', value: '1', pointer_ids: [2, 3] },
    { id: 2, kind: 'node', value: '2', pointer_ids: [4] },
    { id: 3, kind: 'node', value: '3', pointer_ids: [4] },
    { id: 4, kind: 'node', value: '4', pointer_ids: [] },
  ]

  const selected = getRecursiveChildNodeIds(1, elements)
  assert.deepEqual(Array.from(selected).sort(), [1, 2, 3, 4])
  assert.equal(selected.size, 4)
})

test('getRecursiveChildNodeIds ignores dangling pointers and non-node targets', () => {
  const elements = [
    { id: 1, kind: 'node', value: '1', pointer_ids: [2, 99, 100] },
    { id: 2, kind: 'node', value: '2', pointer_ids: [3] },
    { id: 3, kind: 'node', value: '3', pointer_ids: [] },
    { id: 100, kind: 'array', values: ['a', 'b'] },
  ]

  const selected = getRecursiveChildNodeIds(1, elements)
  // 99 does not exist, 100 is an array (not kind === 'node')
  assert.deepEqual(Array.from(selected).sort(), [1, 2, 3])
})

test('getRecursiveChildNodeIds returns empty Set when starting element is not a node or does not exist', () => {
  const elements = [
    { id: 1, kind: 'node', value: '1', pointer_ids: [] },
    { id: 2, kind: 'array', values: ['x'] },
  ]

  assert.equal(getRecursiveChildNodeIds(999, elements).size, 0)
  assert.equal(getRecursiveChildNodeIds(2, elements).size, 0)
})

