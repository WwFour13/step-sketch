import { iteratorColors, knownProblemSlugs, leetCodeQuery } from '../constants/sketch'
import type {
  LeetCodeProblemIndex,
  LeetCodeQuestion,
  SketchArray,
  SketchElement,
  SketchIterator,
  SketchNode,
} from '../types/sketch'

export const getInputNames = (code: string) => {
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

export const getFirstTestcase = (exampleTestcases: string, inputCount: number) =>
  exampleTestcases
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, inputCount || 1)

export const getPythonSnippet = (codeSnippets: LeetCodeQuestion['codeSnippets']) =>
  codeSnippets.find((snippet) => snippet.lang.toLowerCase() === 'python')?.code ??
  codeSnippets[0]?.code ??
  ''

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
  const number = problemNumber.trim()
  if (!/^\d+$/.test(number)) {
    throw new Error('Enter a problem number')
  }

  try {
    let titleSlug = knownProblemSlugs[number]
    if (!titleSlug) {
      const indexResponse = await fetch('/leetcode-api/api/problems/all/')
      if (!indexResponse.ok) throw new Error('unable to load problem index')
      const indexPayload = (await indexResponse.json()) as {
        stat_status_pairs: LeetCodeProblemIndex[]
      }
      const problem = indexPayload.stat_status_pairs.find(
        (item) => String(item.stat.frontend_question_id) === number,
      )
      if (!problem) throw new Error('problem number not found')
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
    if (!question) throw new Error('Problem not found')

    const snippet = getPythonSnippet(question.codeSnippets)
    const inputNames = getInputNames(snippet)
    const lines = getFirstTestcase(question.exampleTestcases, inputNames.length)
    const parsedValues = lines.map((line) => {
      try {
        return JSON.parse(line) as unknown
      } catch {
        return line
      }
    })
    const hasLinkedListInput = /\b(ListNode|LinkedList)\b/.test(snippet)
    const hasGraphNodeInput = /\b(GraphNode|Node)\b/.test(snippet) && !hasLinkedListInput
    const hasUnsupportedValue = parsedValues.some(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        (!Array.isArray(value) ||
          value.some((item) => Array.isArray(item) || (typeof item === 'object' && item !== null))),
    )

    const firstId = nextId
    if (hasUnsupportedValue || hasGraphNodeInput || parsedValues.length === 0) {
      const reason = hasGraphNodeInput
        ? 'graph node'
        : parsedValues.some((value) => Array.isArray(value) && value.some(Array.isArray))
          ? '2d array'
          : 'unsupported input structure'
      const fallback: SketchArray = {
        id: firstId,
        kind: 'array',
        label: `LeetCode ${number} testcase`,
        element_ids: [firstId + 1],
        values: [`Missing representation: ${reason}`],
        position: { x: 130, y: 100 },
      }
      return {
        elements: [fallback],
        nextId: currentIdOrOffset(firstId + 2),
        firstId,
        status: question.title,
      }
    }

    let nextImportedId = firstId
    const imported: (SketchElement | SketchElement[])[] = parsedValues.map((value, index) => {
      if (typeof value === 'string') {
        const id = nextImportedId
        const characters = Array.from(value)
        nextImportedId += characters.length + 1
        return {
          id,
          kind: 'array' as const,
          label: inputNames[index] || `arg${index + 1}`,
          element_ids: characters.map((_, characterIndex) => id + characterIndex + 1),
          values: characters,
          position: { x: 130, y: 100 + index * 90 },
        }
      }
      if (Array.isArray(value)) {
        const id = nextImportedId
        if (value.length > 0 && value.every((item) => typeof item === 'string')) {
          const label = inputNames[index] || `arg${index + 1}`
          const stringArrays: SketchArray[] = value.map((item, stringIndex) => {
            const stringId = nextImportedId
            const characters = Array.from(item as string)
            nextImportedId += characters.length + 1
            return {
              id: stringId,
              kind: 'array',
              label: `${label}[${stringIndex}]`,
              element_ids: characters.map((_, characterIndex) => stringId + characterIndex + 1),
              values: characters,
              position: { x: 130, y: 100 + (index + stringIndex) * 90 },
            }
          })
          return stringArrays
        }
        const label = inputNames[index] || `arg${index + 1}`
        if (hasLinkedListInput) {
          const nodes: SketchNode[] = value.map((item, nodeIndex) => ({
            id: id + nodeIndex,
            kind: 'node' as const,
            label: '',
            value: String(item),
            pointer_ids: nodeIndex < value.length - 1 ? [id + nodeIndex + 1] : [],
            position: { x: 130 + nodeIndex * 90, y: 100 + index * 110 },
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
            nextImportedId += nodes.length + 1
            return [...nodes, iterator]
          }
          nextImportedId += nodes.length
          return nodes
        }
        nextImportedId += value.length + 1
        return {
          id,
          kind: 'array' as const,
          label,
          element_ids: value.map((_, valueIndex) => id + valueIndex + 1),
          values: value.map(String),
          position: { x: 130, y: 100 + index * 90 },
        }
      }
      const id = nextImportedId
      nextImportedId += 1
      return {
        id,
        kind: 'variable' as const,
        label: inputNames[index] || `arg${index + 1}`,
        value: String(value),
        position: { x: 130, y: 100 + index * 90 },
      }
    })

    const flatImported: SketchElement[] = imported.flat()
    return {
      elements: flatImported,
      nextId: nextImportedId,
      firstId,
      status: question.title,
    }
  } catch (error) {
    const fallback: SketchArray = {
      id: nextId,
      kind: 'array',
      label: `LeetCode ${number} testcase`,
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

const currentIdOrOffset = (val: number) => val
