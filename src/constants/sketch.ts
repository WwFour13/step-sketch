import type { IteratorColor, SketchElement } from '../types/sketch'

export const NODE_RADIUS = 27

export const iteratorColors: IteratorColor[] = ['red', 'green', 'blue', 'yellow']

export const initialElements: SketchElement[] = [
  {
    id: 1,
    kind: 'array',
    label: 'nums',
    element_ids: [2, 3, 4, 5],
    values: ['2', '7', '11', '15'],
    position: { x: 88, y: 150 },
  },
  {
    id: 6,
    kind: 'array',
    label: 'word',
    element_ids: [7, 8, 9, 10, 11, 12, 13, 14],
    values: ['l', 'e', 'e', 't', 'c', 'o', 'd', 'e'],
    position: { x: 388, y: 338 },
  },
]

export const leetCodeQuery = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      exampleTestcases
      codeSnippets {
        lang
        code
      }
    }
  }
`

export const knownProblemSlugs: Record<string, string> = { '2': 'add-two-numbers' }
