import { CELL_SIZE, NODE_SIZE, iteratorColors } from '../constants/sketch'
import type { SketchElement, SketchNode } from '../types/sketch'

export type ParsedInput = {
  name: string
  value: unknown
  shape?: InputShape
  nodeStructure?: NodeStructure
}

export type NodeStructure = 'linked-list' | 'binary-tree' | 'graph'
export type InputShape =
  | 'scalar'
  | 'string'
  | 'array'
  | 'array_of_strings'
  | 'matrix'
  | 'array_of_arrays'
  | 'linked_list'
  | 'list_of_linked_lists'
  | 'binary_tree'
  | 'graph_adjacency_list'
  | 'graph_edge_list'
  | 'interval_list'

export type ParsedTestCase = {
  id: number
  rawLines: string[]
  parsedInputs: ParsedInput[]
  previewElements: SketchElement[]
}

export type LeetCodeSketchProblemDetail = {
  questionId: string
  title: string
  titleSlug: string
  inputNames: string[]
  testCases: ParsedTestCase[]
}

type LeetCodeSketchInputRecord = {
  name: string
  value: unknown
  nodeStructure: NodeStructure | null
  shape?: InputShape
}

type LeetCodeSketchProblemRecord = {
  questionId: number
  title: string
  titleSlug: string
  testCases: { inputs: LeetCodeSketchInputRecord[] }[]
}

/**
 * Converts one parsed test case into positioned canvas elements using semantic
 * shape labels and legacy node-structure hints.
 * @param testCase Parsed inputs, including any inferred node-structure kinds.
 * @param startId First unused element ID for the generated structure.
 * @param basePosition Top-left canvas position for the generated structures.
 * @returns Generated elements, the next unused ID, and the occupied height.
 */
export const buildTestCaseElements = (
  testCase: { parsedInputs: ParsedInput[] },
  startId: number,
  basePosition: { x: number; y: number },
): { elements: SketchElement[]; nextId: number; height: number } => {
  let nextId = startId
  const elements: SketchElement[] = []
  let currentY = basePosition.y

  testCase.parsedInputs.forEach((input, index) => {
    const { name: label, value } = input

    if (input.shape === 'list_of_linked_lists') {
      if (!Array.isArray(value) || !value.every(Array.isArray)) {
        throw new Error(
          `Input "${label}" is labeled list_of_linked_lists but is not an array of arrays`,
        )
      }
      if (value.length === 0) {
        elements.push({
          id: nextId,
          kind: 'array',
          label,
          input_type: 'number',
          element_ids: [],
          values: [],
          position: { x: basePosition.x, y: currentY },
        })
        nextId += 1
        currentY += 90
        return
      }

      value.forEach((list, listIndex) => {
        const listLabel = `${label}[${listIndex}]`
        const firstNodeId = nextId
        const nodes: SketchNode[] = list.map((item, nodeIndex) => ({
          id: firstNodeId + nodeIndex,
          kind: 'node',
          value: String(item),
          pointer_ids: nodeIndex < list.length - 1 ? [firstNodeId + nodeIndex + 1] : [],
          pointer_limit: 1,
          position: { x: basePosition.x + nodeIndex * 90, y: currentY },
        }))
        elements.push(...nodes)
        nextId += nodes.length
        if (nodes.length > 0) {
          elements.push({
            id: nextId,
            kind: 'iterator',
            hostId: firstNodeId,
            color: iteratorColors[(index + listIndex) % iteratorColors.length],
            mode: 'bottom',
            label: listLabel,
          })
          nextId += 1
        } else {
          elements.push({
            id: nextId,
            kind: 'variable',
            label: listLabel,
            value: '∅',
            position: { x: basePosition.x, y: currentY },
          })
          nextId += 1
        }
        currentY += 110
      })
      return
    }

    const nodeStructure = input.shape
      ? input.shape === 'linked_list'
        ? 'linked-list'
        : input.shape === 'binary_tree'
          ? 'binary-tree'
          : input.shape === 'graph_adjacency_list'
            ? 'graph'
            : undefined
      : input.nodeStructure

    if (nodeStructure && (Array.isArray(value) || value === null)) {
      const nodeValues = Array.isArray(value) ? value : []
      const firstNodeId = nextId

      if (nodeStructure === 'linked-list') {
        const nodes: SketchNode[] = nodeValues.map((item, nodeIndex) => ({
          id: firstNodeId + nodeIndex,
          kind: 'node',
          value: String(item),
          pointer_ids: nodeIndex < nodeValues.length - 1 ? [firstNodeId + nodeIndex + 1] : [],
          pointer_limit: 1,
          position: { x: basePosition.x + nodeIndex * 90, y: currentY },
        }))
        elements.push(...nodes)
        nextId += nodes.length
        if (nodes.length > 0) {
          elements.push({
            id: nextId,
            kind: 'iterator',
            hostId: firstNodeId,
            color: iteratorColors[index % iteratorColors.length],
            mode: 'bottom',
            label,
          })
          nextId += 1
        }
        currentY += 110
        return
      }

      if (nodeStructure === 'binary-tree') {
        const nodesByIndex = new Map<number, SketchNode>()
        const depthByIndex = new Map<number, number>()
        const orderByIndex = new Map<number, number>()
        nodeValues.forEach((item, nodeIndex) => {
          if (item === null) return
          nodesByIndex.set(nodeIndex, {
            id: firstNodeId + nodeIndex,
            kind: 'node',
            value: String(item),
            pointer_ids: [],
            pointer_limit: 2,
            position: { x: basePosition.x, y: currentY },
          })
        })

        const pendingParents = nodeValues[0] === null ? [] : [0]
        depthByIndex.set(0, 0)
        orderByIndex.set(0, 0)
        let childIndex = 1
        while (pendingParents.length > 0 && childIndex < nodeValues.length) {
          const parentIndex = pendingParents.shift()!
          const parent = nodesByIndex.get(parentIndex)
          const depth = depthByIndex.get(parentIndex) ?? 0
          for (let side = 0; side < 2 && childIndex < nodeValues.length; side += 1) {
            const currentChildIndex = childIndex
            childIndex += 1
            if (nodeValues[currentChildIndex] === null) continue
            const child = nodesByIndex.get(currentChildIndex)
            if (!parent || !child) continue
            parent.pointer_ids.push(child.id)
            depthByIndex.set(currentChildIndex, depth + 1)
            orderByIndex.set(currentChildIndex, (orderByIndex.get(parentIndex) ?? 0) * 2 + side)
            pendingParents.push(currentChildIndex)
          }
        }

        const maxDepth = Math.max(0, ...depthByIndex.values())
        const treeWidth = Math.max(NODE_SIZE, 72 * 2 ** maxDepth)
        nodesByIndex.forEach((node, nodeIndex) => {
          const depth = depthByIndex.get(nodeIndex) ?? 0
          const order = orderByIndex.get(nodeIndex) ?? 0
          node.position = {
            x: basePosition.x + ((order + 0.5) * treeWidth) / 2 ** depth - NODE_SIZE / 2,
            y: currentY + depth * 90,
          }
        })
        elements.push(...nodesByIndex.values())
        nextId += nodeValues.length
        currentY += Math.max(110, (maxDepth + 1) * 90)
        return
      }

      const adjacencyLists = nodeValues as unknown[][]
      const count = adjacencyLists.length
      const radius = Math.max(55, count * 18)
      const centerX = basePosition.x + radius + NODE_SIZE / 2
      const centerY = currentY + radius + NODE_SIZE / 2
      const nodes: SketchNode[] = adjacencyLists.map((neighbors, nodeIndex) => ({
        id: firstNodeId + nodeIndex,
        kind: 'node',
        value: String(nodeIndex + 1),
        pointer_ids: Array.isArray(neighbors)
          ? neighbors
              .filter(
                (neighbor): neighbor is number =>
                  typeof neighbor === 'number' &&
                  Number.isInteger(neighbor) &&
                  neighbor >= 1 &&
                  neighbor <= count,
              )
              .map((neighbor) => firstNodeId + neighbor - 1)
          : [],
        pointer_limit: '+',
        position: {
          x:
            centerX +
            radius * Math.cos((2 * Math.PI * nodeIndex) / Math.max(1, count)) -
            NODE_SIZE / 2,
          y:
            centerY +
            radius * Math.sin((2 * Math.PI * nodeIndex) / Math.max(1, count)) -
            NODE_SIZE / 2,
        },
      }))
      elements.push(...nodes)
      nextId += nodes.length
      currentY += Math.max(130, radius * 2 + NODE_SIZE + 20)
      return
    }

    if (typeof value === 'string') {
      const id = nextId
      const characters = Array.from(value)
      nextId += characters.length + 1
      elements.push({
        id,
        kind: 'array',
        label,
        input_type: 'character',
        element_ids: characters.map((_, characterIndex) => id + characterIndex + 1),
        values: characters,
        position: { x: basePosition.x, y: currentY },
      })
      currentY += 90
      return
    }

    if (Array.isArray(value)) {
      const id = nextId

      if (
        (input.shape === 'array_of_arrays' ||
          input.shape === 'graph_edge_list' ||
          input.shape === 'interval_list') &&
        value.every(Array.isArray)
      ) {
        if (value.length === 0) {
          elements.push({
            id,
            kind: 'array',
            label,
            input_type: 'number',
            element_ids: [],
            values: [],
            position: { x: basePosition.x, y: currentY },
          })
          nextId += 1
          currentY += 90
          return
        }

        value.forEach((row, rowIndex) => {
          const rowId = nextId
          const rowValues = row.map(String)
          nextId += rowValues.length + 1
          const isCharacterRow =
            rowValues.length > 0 &&
            rowValues.some((v) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v))
          elements.push({
            id: rowId,
            kind: 'array',
            label: `${label}[${rowIndex}]`,
            input_type: isCharacterRow ? 'character' : 'number',
            element_ids: rowValues.map((_, valueIndex) => rowId + valueIndex + 1),
            values: rowValues,
            position: { x: basePosition.x, y: currentY },
          })
          currentY += 90
        })
        return
      }

      // Array of strings: e.g. ["flower", "flow", "flight"]
      if (
        value.length > 0 &&
        value.every((item) => typeof item === 'string') &&
        (input.shape === 'array_of_strings' ||
          (input.shape !== 'array' && value.some((item) => (item as string).length > 1)))
      ) {
        value.forEach((item, stringIndex) => {
          const stringId = nextId
          const characters = Array.from(item as string)
          nextId += characters.length + 1
          elements.push({
            id: stringId,
            kind: 'array',
            label: `${label}[${stringIndex}]`,
            input_type: 'character',
            element_ids: characters.map((_, characterIndex) => stringId + characterIndex + 1),
            values: characters,
            position: { x: basePosition.x, y: currentY },
          })
          currentY += 90
        })
        return
      }

      if (
        value.length > 0 &&
        value.every(Array.isArray) &&
        (input.shape === 'matrix' || input.shape === undefined)
      ) {
        const rows = value as unknown[][]
        const columns = Math.max(1, ...rows.map((row) => row.length))
        const matrixValues = rows.map((row) => [
          ...row.map(String),
          ...Array<string>(columns - row.length).fill(''),
        ])
        const matrixId = nextId
        nextId += matrixValues.flat().length + 1
        elements.push({
          id: matrixId,
          kind: 'matrix',
          label,
          element_ids: matrixValues.map((row, rowIndex) =>
            row.map((_, columnIndex) => matrixId + rowIndex * columns + columnIndex + 1),
          ),
          values: matrixValues,
          position: { x: basePosition.x, y: currentY },
          columns,
        })
        currentY += Math.max(90, matrixValues.length * CELL_SIZE + 35)
        return
      }

      // Standard 1D array
      const isCharacterArray =
        input.shape === 'string' ||
        (value.length > 0 &&
          value.some(
            (item) => typeof item === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(item),
          ))
      nextId += value.length + 1
      elements.push({
        id,
        kind: 'array',
        label,
        input_type: isCharacterArray ? 'character' : 'number',
        element_ids: value.map((_, valueIndex) => id + valueIndex + 1),
        values: value.map(String),
        position: { x: basePosition.x, y: currentY },
      })
      currentY += 90
      return
    }

    // Primitive variable (number, boolean, etc.)
    const id = nextId
    nextId += 1
    elements.push({
      id,
      kind: 'variable',
      label,
      value: String(value),
      position: { x: basePosition.x, y: currentY },
    })
    currentY += 90
  })

  return {
    elements,
    nextId,
    height: Math.max(90, currentY - basePosition.y),
  }
}

/**
 * Lays out several selected test cases vertically and assigns IDs without
 * collisions across the generated groups.
 * @param selectedCases Test cases to add to the canvas.
 * @param startId First unused element ID.
 * @param startY Canvas-space y-coordinate where the first case begins.
 */
export const buildCanvasElementsFromTestCases = (
  selectedCases: ParsedTestCase[],
  startId: number,
  startY: number = 100,
): { elements: SketchElement[]; nextId: number } => {
  let curId = startId
  let curY = startY
  const allElements: SketchElement[] = []

  for (const testCase of selectedCases) {
    const result = buildTestCaseElements(testCase, curId, { x: 130, y: curY })
    allElements.push(...result.elements)
    curId = result.nextId
    curY += result.height + 40
  }

  return { elements: allElements, nextId: curId }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isJsonValue = (value: unknown): boolean => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (isRecord(value)) return Object.values(value).every(isJsonValue)
  return false
}

const isNodeStructure = (value: unknown): value is NodeStructure =>
  value === 'linked-list' || value === 'binary-tree' || value === 'graph'

const inputShapes = new Set<string>([
  'scalar',
  'string',
  'array',
  'array_of_strings',
  'matrix',
  'array_of_arrays',
  'linked_list',
  'list_of_linked_lists',
  'binary_tree',
  'graph_adjacency_list',
  'graph_edge_list',
  'interval_list',
])

const isInputShape = (value: unknown): value is InputShape =>
  typeof value === 'string' && inputShapes.has(value)

const isValueCompatibleWithShape = (shape: InputShape, value: unknown): boolean => {
  if (shape === 'scalar') {
    return value === null || typeof value === 'boolean' || typeof value === 'number'
  }
  if (shape === 'string') return typeof value === 'string'
  if (!Array.isArray(value)) return false
  if (shape === 'array') return value.every((item) => !Array.isArray(item))
  if (shape === 'array_of_strings') return value.every((item) => typeof item === 'string')
  if (shape === 'linked_list') return value.every((item) => !Array.isArray(item))
  if (shape === 'binary_tree') {
    return value.every(
      (item) =>
        item === null ||
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean',
    )
  }
  if (shape === 'matrix') return value.every(Array.isArray)
  return value.every(Array.isArray)
}

const isLeetCodeSketchInputRecord = (value: unknown): value is LeetCodeSketchInputRecord =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  value.name.trim().length > 0 &&
  Object.hasOwn(value, 'value') &&
  isJsonValue(value.value) &&
  (value.shape === undefined ||
    (isInputShape(value.shape) && isValueCompatibleWithShape(value.shape, value.value))) &&
  (value.nodeStructure === null || isNodeStructure(value.nodeStructure))

const isLeetCodeSketchProblemRecord = (
  value: unknown,
  expectedId: string,
): value is LeetCodeSketchProblemRecord =>
  isRecord(value) &&
  Number.isInteger(value.questionId) &&
  String(value.questionId) === expectedId &&
  typeof value.title === 'string' &&
  typeof value.titleSlug === 'string' &&
  Array.isArray(value.testCases) &&
  value.testCases.every(
    (testCase) =>
      isRecord(testCase) &&
      Array.isArray(testCase.inputs) &&
      testCase.inputs.length > 0 &&
      testCase.inputs.every(isLeetCodeSketchInputRecord),
  )

const problemDetailsCache = new Map<number, Promise<LeetCodeSketchProblemDetail>>()

const fetchLeetCodeSketchProblemDetails = async (
  normalizedNumber: number,
): Promise<LeetCodeSketchProblemDetail> => {
  const response = await fetch(`/api/leetcode-sketch/problems/${normalizedNumber}`)
  const payload: unknown = await response.json()
  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.error === 'string'
        ? payload.error
        : `Unable to load problem #${normalizedNumber} (${response.status})`
    throw new Error(message)
  }
  if (!isLeetCodeSketchProblemRecord(payload, String(normalizedNumber))) {
    throw new Error('LeetCode Sketch API returned an unsupported or invalid format')
  }
  const record = payload

  const inputNames = [
    ...new Set(record.testCases.flatMap(({ inputs }) => inputs.map(({ name }) => name))),
  ]
  const testCases: ParsedTestCase[] = record.testCases.map(({ inputs }, id) => {
    const parsedInputs: ParsedInput[] = inputs.map(({ name, value, shape, nodeStructure }) => ({
      name,
      value,
      ...(shape ? { shape } : {}),
      ...(nodeStructure ? { nodeStructure } : {}),
    }))
    const preview = buildTestCaseElements({ parsedInputs }, 1, { x: 12, y: 12 })
    return {
      id,
      rawLines: inputs.map(({ value }) => JSON.stringify(value)),
      parsedInputs,
      previewElements: preview.elements,
    }
  })

  return {
    questionId: String(record.questionId),
    title: record.title,
    titleSlug: record.titleSlug,
    inputNames,
    testCases,
  }
}

/**
 * Loads one LeetCode Sketch problem and reuses it for this page session.
 * Failed requests are removed from the cache so they can be retried.
 * @param problemNumber Numeric question ID entered by the user.
 * @throws Error when the ID is invalid, absent, or malformed in the dataset.
 */
export const loadLeetCodeSketchProblemDetails = (
  problemNumber: string,
): Promise<LeetCodeSketchProblemDetail> => {
  const number = problemNumber.trim()
  if (!/^\d+$/.test(number)) {
    throw new Error('Please enter a valid problem number')
  }
  const normalizedNumber = Number(number)
  if (!Number.isSafeInteger(normalizedNumber) || normalizedNumber < 1) {
    throw new Error('Please enter a valid problem number')
  }

  const cachedRequest = problemDetailsCache.get(normalizedNumber)
  if (cachedRequest) return cachedRequest

  const request = fetchLeetCodeSketchProblemDetails(normalizedNumber)
  problemDetailsCache.set(normalizedNumber, request)
  void request.catch(() => {
    if (problemDetailsCache.get(normalizedNumber) === request) {
      problemDetailsCache.delete(normalizedNumber)
    }
  })
  return request
}
