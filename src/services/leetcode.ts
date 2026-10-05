import { CELL_SIZE, iteratorColors, knownProblemSlugs, leetCodeQuery } from '../constants/sketch'
import type {
  LeetCodeProblemIndex,
  LeetCodeQuestion,
  SketchArray,
  SketchElement,
  SketchIterator,
  SketchNode,
} from '../types/sketch'

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

export const getFirstTestcase = (exampleTestcases: string, inputCount: number): string[] =>
  exampleTestcases
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, inputCount || 1)

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

export const getPythonSnippet = (codeSnippets: LeetCodeQuestion['codeSnippets']): string =>
  codeSnippets.find((snippet) => snippet.lang.toLowerCase() === 'python')?.code ??
  codeSnippets[0]?.code ??
  ''

export type ParsedInput = {
  name: string
  value: unknown
}

export type ParsedTestCase = {
  id: number
  rawLines: string[]
  parsedInputs: ParsedInput[]
  hasLinkedListInput: boolean
  previewElements: SketchElement[]
}

export type LeetCodeProblemDetail = {
  questionId: string
  title: string
  titleSlug: string
  description?: string
  inputNames: string[]
  hasLinkedListInput: boolean
  testCases: ParsedTestCase[]
}

export const buildTestCaseElements = (
  testCase: { parsedInputs: ParsedInput[]; hasLinkedListInput: boolean },
  startId: number,
  basePosition: { x: number; y: number },
): { elements: SketchElement[]; nextId: number; height: number } => {
  let nextId = startId
  const elements: SketchElement[] = []
  let currentY = basePosition.y

  testCase.parsedInputs.forEach((input, index) => {
    const { name: label, value } = input

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

      // Linked list
      if (testCase.hasLinkedListInput) {
        const nodes: SketchNode[] = value.map((item, nodeIndex) => ({
          id: id + nodeIndex,
          kind: 'node',
          label: '',
          value: String(item),
          pointer_ids: nodeIndex < value.length - 1 ? [id + nodeIndex + 1] : [],
          position: { x: basePosition.x + nodeIndex * 90, y: currentY },
        }))

        if (nodes.length > 0) {
          const iteratorId = id + nodes.length
          const iterator: SketchIterator = {
            id: iteratorId,
            kind: 'iterator',
            hostId: id,
            color: iteratorColors[index % iteratorColors.length],
            mode: 'bottom',
            label,
          }
          nextId += nodes.length + 1
          elements.push(...nodes, iterator)
        } else {
          nextId += nodes.length
          elements.push(...nodes)
        }
        currentY += 110
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

export const fetchLeetCodeProblemDetails = async (
  problemNumber: string,
): Promise<LeetCodeProblemDetail> => {
  const number = problemNumber.trim()
  if (!/^\d+$/.test(number)) {
    throw new Error('Please enter a valid problem number')
  }

  let titleSlug = knownProblemSlugs[number]
  if (!titleSlug) {
    const indexResponse = await fetch('/leetcode-api/api/problems/all/')
    if (!indexResponse.ok) throw new Error('Unable to load problem index')
    const indexPayload = (await indexResponse.json()) as {
      stat_status_pairs: LeetCodeProblemIndex[]
    }
    const problem = indexPayload.stat_status_pairs.find(
      (item) => String(item.stat.frontend_question_id) === number,
    )
    if (!problem) throw new Error(`Problem #${number} not found`)
    titleSlug = problem.stat.question__title_slug
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
  const hasLinkedListInput = /\b(ListNode|LinkedList)\b/.test(snippet)

  const testCases: ParsedTestCase[] = rawTestCases.map((rawLines, caseIndex) => {
    const parsedInputs: ParsedInput[] = rawLines.map((line, argIndex) => {
      const name = inputNames[argIndex] || `arg${argIndex + 1}`
      let value: unknown
      try {
        value = JSON.parse(line)
      } catch {
        value = line
      }
      return { name, value }
    })

    const preview = buildTestCaseElements({ parsedInputs, hasLinkedListInput }, 1, { x: 12, y: 12 })

    return {
      id: caseIndex,
      rawLines,
      parsedInputs,
      hasLinkedListInput,
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
    hasLinkedListInput,
    testCases,
  }
}

export type LeetCodeFetchResult = {
  elements: SketchElement[]
  nextId: number
  firstId: number
  status: string
}

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
