import type { IteratorColor, IteratorMode, PointerLimit, SketchElement } from '../types/sketch'

/** Shared canvas dimensions used by bounds, layout, and rendering helpers. */
export const NODE_RADIUS = 27
export const NODE_SIZE = 54
export const CELL_SIZE = 42
export const MAP_CELL_WIDTH = CELL_SIZE * 2

/** Palette and placement sides cycled through when creating iterators. */
export const iteratorColors: IteratorColor[] = ['red', 'green', 'blue', 'yellow']
export const iteratorModes: IteratorMode[] = ['top', 'bottom', 'left', 'right']
export const pointerLimits: PointerLimit[] = [1, 2, '+']

/** Initial example data shown when the sketch canvas first loads. */
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

/** GraphQL query used to request the question data needed by the importer. */
export const leetCodeQuery = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      content
      exampleTestcases
      codeSnippets {
        lang
        code
      }
    }
  }
`

/** Known question-number mappings avoid loading the full LeetCode problem index. */
export const knownProblemSlugs: Record<string, string> = {
  '1': 'two-sum',
  '2': 'add-two-numbers',
  '3': 'longest-substring-without-repeating-characters',
  '14': 'longest-common-prefix',
  '48': 'rotate-image',
  '70': 'climbing-stairs',
  '94': 'binary-tree-inorder-traversal',
  '133': 'clone-graph',
  '206': 'reverse-linked-list',
}
