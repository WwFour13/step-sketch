export type Position = {
  x: number
  y: number
}

export type SketchVariable = {
  id: number
  kind: 'variable'
  label: string
  value: string
  position: Position
}

export type SketchArray = {
  id: number
  kind: 'array'
  label: string
  element_ids: number[]
  values: string[]
  position: Position
  layout?: 'horizontal' | 'vertical' | 'map' | 'matrix'
  columns?: number
}

export type SketchNode = Omit<SketchVariable, 'kind'> & {
  kind: 'node'
  pointer_ids: number[]
}

export type IteratorColor = 'red' | 'green' | 'blue' | 'yellow'
export type IteratorMode = 'top' | 'bottom' | 'left' | 'right'

export type SketchIterator = {
  id: number
  kind: 'iterator'
  hostId: number
  color: IteratorColor
  mode?: IteratorMode
  label?: string
}

export type SketchElement = SketchVariable | SketchArray | SketchNode | SketchIterator

export type LeetCodeQuestion = {
  title: string
  content?: string
  exampleTestcases: string
  codeSnippets: {
    lang: string
    code: string
  }[]
}

export type LeetCodeProblemIndex = {
  stat: {
    frontend_question_id: number
    question__title_slug: string
  }
}

export type DragState = {
  id: number
  offsetX: number
  offsetY: number
  draggedIds: Set<number>
  initialPositions: Map<number, Position>
}

export type PointerDraft = {
  sourceId: number
  x: number
  y: number
}

export type RelationshipDrag = {
  sourceId: number
  targetId: number
  startX: number
  startY: number
}

export type IteratorDragState = {
  id: number
  x: number
  y: number
}

export type CellEditState = {
  arrayId: number
  index: number
  hasTyped: boolean
}

export type MarqueeDrag = {
  startX: number
  startY: number
  additive: boolean
}

export type SelectionBox = {
  x: number
  y: number
  width: number
  height: number
}
