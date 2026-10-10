import {
  CELL_SIZE,
  NODE_SIZE,
  iteratorColors,
  knownProblemSlugs,
  leetCodeQuery,
} from '../constants/sketch'
import type {
  LeetCodeProblemIndex,
  LeetCodeQuestion,
  SketchArray,
  SketchElement,
  SketchNode,
} from '../types/sketch'

/**
 * Extracts parameter names from a LeetCode solution signature for labeling
 * parsed test-case inputs.
 * @param code Source snippet used to infer the function's argument names.
 */
export const getInputNames = (code: string): string[] => {
  const solutionCode = code.match(/class\s+Solution[\s\S]*/)
    ? code.match(/class\s+Solution[\s\S]*/)![0]
    : code
  const signature = solutionCode.match(
    /(?:def\s+\w+|function\s+\w+|\w+\s*=\s*\([^)]*\))\s*\(([^)]*)\)/,
  )
  if (!signature) return []
  return signature[1]
    .split(',')
    .map((name) => name.trim().replace(/=.*/, '').split(':')[0].trim())
    .filter((name) => name && name !== 'self')
}

/**
 * Returns the first case's input lines, limited to the expected argument count.
 */
export const getFirstTestcase = (exampleTestcases: string, inputCount: number): string[] =>
  exampleTestcases
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, inputCount || 1)

/**
 * Groups the flat example-input lines into test cases with the given arity.
 */
export const getAllTestcases = (exampleTestcases: string, inputCount: number): string[][] => {
  const lines = exampleTestcases
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const step = Math.max(1, inputCount)
  const testcases: string[][] = []
  for (let i = 0; i < lines.length; i += step) {
    testcases.push(lines.slice(i, i + step))
  }
  return testcases
}

/**
 * Identifies common LeetCode node types from the supplied solution snippet.
 * Graph inputs are recognized by their conventional neighbors property.
 */
export const inferNodeStructure = (code: string): NodeStructure | undefined => {
  if (/\b(ListNode|LinkedList)\b/.test(code)) return 'linked-list'
  if (/\bTreeNode\b/.test(code)) return 'binary-tree'
  if (/\bneighbors\b/i.test(code)) return 'graph'
  return undefined
}

/** Prefers the Python solution snippet and falls back to the first available language. */
export const getPythonSnippet = (codeSnippets: LeetCodeQuestion['codeSnippets']): string =>
  codeSnippets.find((snippet) => snippet.lang.toLowerCase() === 'python')?.code ??
  codeSnippets[0]?.code ??
  ''

export type ParsedInput = {
  name: string
  value: unknown
  nodeStructure?: NodeStructure
}

export type NodeStructure = 'linked-list' | 'binary-tree' | 'graph'

export type ParsedTestCase = {
  id: number
  rawLines: string[]
  parsedInputs: ParsedInput[]
  previewElements: SketchElement[]
}

export type LeetCodeProblemDetail = {
  questionId: string
  title: string
  titleSlug: string
  description?: string
  inputNames: string[]
  testCases: ParsedTestCase[]
}

/**
 * Converts one parsed test case into positioned canvas elements. Inputs
 * recognized as linked lists, binary trees, or graphs become pointer nodes;
 * other strings, arrays, and primitives retain their ordinary representations.
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

    if (input.nodeStructure && (Array.isArray(value) || value === null)) {
      const nodeValues = Array.isArray(value) ? value : []
      const firstNodeId = nextId

      if (input.nodeStructure === 'linked-list') {
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

      if (input.nodeStructure === 'binary-tree') {
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
        element_ids: characters.map((_, characterIndex) => id + characterIndex + 1),
        values: characters,
        position: { x: basePosition.x, y: currentY },
      })
      currentY += 90
      return
    }

    if (Array.isArray(value)) {
      const id = nextId

      // Array of strings: e.g. ["flower", "flow", "flight"]
      if (value.length > 0 && value.every((item) => typeof item === 'string')) {
        value.forEach((item, stringIndex) => {
          const stringId = nextId
          const characters = Array.from(item as string)
          nextId += characters.length + 1
          elements.push({
            id: stringId,
            kind: 'array',
            label: `${label}[${stringIndex}]`,
            element_ids: characters.map((_, characterIndex) => stringId + characterIndex + 1),
            values: characters,
            position: { x: basePosition.x, y: currentY },
          })
          currentY += 90
        })
        return
      }

      if (value.length > 0 && value.every(Array.isArray)) {
        const rows = value as unknown[][]
        const columns = Math.max(1, ...rows.map((row) => row.length))
        const matrixValues = rows.flatMap((row) => [
          ...row.map(String),
          ...Array<string>(columns - row.length).fill(''),
        ])
        const matrixId = nextId
        nextId += matrixValues.length + 1
        elements.push({
          id: matrixId,
          kind: 'array',
          label,
          element_ids: matrixValues.map((_, cellIndex) => matrixId + cellIndex + 1),
          values: matrixValues,
          position: { x: basePosition.x, y: currentY },
          layout: 'matrix',
          columns,
        })
        currentY += Math.max(90, rows.length * CELL_SIZE + 35)
        return
      }

      // Standard 1D array
      nextId += value.length + 1
      elements.push({
        id,
        kind: 'array',
        label,
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

/** Removes markup and decodes common entities from a problem description. */
export const stripHtml = (html: string): string => {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

let problemSlugIndexPromise: Promise<Map<string, string>> | null = null

const getProblemSlugIndex = (): Promise<Map<string, string>> => {
  if (!problemSlugIndexPromise) {
    problemSlugIndexPromise = fetch('/leetcode-api/api/problems/all/')
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load problem index')
        const payload = (await response.json()) as {
          stat_status_pairs?: LeetCodeProblemIndex[]
        }
        if (!Array.isArray(payload.stat_status_pairs)) {
          throw new Error('Invalid problem index response')
        }
        return new Map(
          payload.stat_status_pairs.map((item) => [
            String(item.stat.frontend_question_id),
            item.stat.question__title_slug,
          ]),
        )
      })
      .catch((error: unknown) => {
        problemSlugIndexPromise = null
        throw error
      })
  }
  return problemSlugIndexPromise
}

/**
 * Resolves a problem number to its LeetCode question, parses example inputs,
 * and returns preview-ready cases plus metadata used by the import modal.
 * @param problemNumber Numeric question ID entered by the user.
 * @throws Error when the ID is invalid, unavailable, or the request fails.
 */
export const fetchLeetCodeProblemDetails = async (
  problemNumber: string,
): Promise<LeetCodeProblemDetail> => {
  const number = problemNumber.trim()
  if (!/^\d+$/.test(number)) {
    throw new Error('Please enter a valid problem number')
  }

  let titleSlug = knownProblemSlugs[number]
  if (!titleSlug) {
    const problemSlugs = await getProblemSlugIndex()
    titleSlug = problemSlugs.get(number) ?? ''
    if (!titleSlug) throw new Error(`Problem #${number} not found`)
  }

  const response = await fetch('/leetcode-api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: leetCodeQuery, variables: { titleSlug } }),
  })
  if (!response.ok) throw new Error('LeetCode request failed')
  const payload = (await response.json()) as { data?: { question?: LeetCodeQuestion | null } }
  const question = payload.data?.question
  if (!question) throw new Error(`Problem #${number} not found`)

  const snippet = getPythonSnippet(question.codeSnippets)
  const inputNames = getInputNames(snippet)
  const rawTestCases = getAllTestcases(question.exampleTestcases, inputNames.length)
  const nodeStructure = inferNodeStructure(snippet)

  const testCases: ParsedTestCase[] = rawTestCases.map((rawLines, caseIndex) => {
    const parsedInputs: ParsedInput[] = rawLines.map((line, argIndex) => {
      const name = inputNames[argIndex] || `arg${argIndex + 1}`
      let value: unknown
      try {
        value = JSON.parse(line)
      } catch {
        value = line
      }
      const isNodeInput =
        nodeStructure !== undefined &&
        (Array.isArray(value) || (nodeStructure !== 'graph' && value === null)) &&
        (nodeStructure !== 'graph' ||
          (Array.isArray(value) && value.every((item) => Array.isArray(item))))
      return { name, value, ...(isNodeInput ? { nodeStructure } : {}) }
    })

    const preview = buildTestCaseElements({ parsedInputs }, 1, { x: 12, y: 12 })

    return {
      id: caseIndex,
      rawLines,
      parsedInputs,
      previewElements: preview.elements,
    }
  })

  const description = question.content ? stripHtml(question.content) : ''

  return {
    questionId: number,
    title: question.title,
    titleSlug,
    description,
    inputNames,
    testCases,
  }
}

export type LeetCodeFetchResult = {
  elements: SketchElement[]
  nextId: number
  firstId: number
  status: string
}

/**
 * Legacy single-case import helper. Returns the first case's canvas elements,
 * or a visible fallback array describing the failure.
 * @param problemNumber LeetCode question number to fetch.
 * @param nextId First unused canvas element ID.
 */
export const fetchLeetCodeTestCase = async (
  problemNumber: string,
  nextId: number,
): Promise<LeetCodeFetchResult> => {
  try {
    const details = await fetchLeetCodeProblemDetails(problemNumber)
    if (details.testCases.length === 0) {
      throw new Error('No testcases found for problem')
    }
    const result = buildCanvasElementsFromTestCases(details.testCases.slice(0, 1), nextId, 100)
    return {
      elements: result.elements,
      nextId: result.nextId,
      firstId: nextId,
      status: details.title,
    }
  } catch (error) {
    const fallback: SketchArray = {
      id: nextId,
      kind: 'array',
      label: `LeetCode ${problemNumber} testcase`,
      element_ids: [nextId + 1],
      values: [
        `Missing representation: ${error instanceof Error ? error.message : 'unable to load problem'}`,
      ],
      position: { x: 130, y: 100 },
    }
    return {
      elements: [fallback],
      nextId: nextId + 2,
      firstId: nextId,
      status: 'Loaded fallback',
    }
  }
}
