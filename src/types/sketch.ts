/** Canvas-space coordinates measured from the canvas's top-left corner. */
export type Position = {
  x: number
  y: number
}

/** Editable scalar value rendered as a square. */
export type SketchVariable = {
  id: number
  kind: 'variable'
  label: string
  value: string
  position: Position
}

/** Collection whose cells have stable IDs for pointers and iterators. */
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

/** Pointer node with references to zero or more other node IDs. */
export type SketchNode = Omit<SketchVariable, 'kind'> & {
  kind: 'node'
  pointer_ids: number[]
  pointer_limit: PointerLimit
}

/** Maximum outgoing pointers allowed on a node; '+' means unbounded. */
export type PointerLimit = 1 | 2 | '+'

/** Iterator appearance and attachment-side choices. */
export type IteratorColor = 'red' | 'green' | 'blue' | 'yellow'
export type IteratorMode = 'top' | 'bottom' | 'left' | 'right'

/** Marker attached to a node or array cell and optionally shown with a label. */
export type SketchIterator = {
  id: number
  kind: 'iterator'
  hostId: number
  color: IteratorColor
  mode?: IteratorMode
  label?: string
}

/** Discriminated union of every element stored on the sketch canvas. */
export type SketchElement = SketchVariable | SketchArray | SketchNode | SketchIterator

/** Question fields returned by the LeetCode GraphQL query. */
export type LeetCodeQuestion = {
  title: string
  content?: string
  exampleTestcases: string
  codeSnippets: {
    lang: string
    code: string
  }[]
}

/** Minimal problem-index entry used to resolve a numeric question ID to a slug. */
export type LeetCodeProblemIndex = {
  stat: {
    frontend_question_id: number
    question__title_slug: string
  }
}

/** Snapshot of element positions and offsets captured at the start of a drag. */
export type DragState = {
  id: number
  offsetX: number
  offsetY: number
  draggedIds: Set<number>
  initialPositions: Map<number, Position>
}

/** Live draft for a pointer being drawn from a source node to the cursor. */
export type PointerDraft = {
  sourceId: number
  x: number
  y: number
}

/** Existing pointer line being dragged so it can be removed on release. */
export type RelationshipDrag = {
  sourceId: number
  targetId: number
  startX: number
  startY: number
}

/** Cursor position for an iterator while it is being dragged. */
export type IteratorDragState = {
  id: number
  x: number
  y: number
}

/** Active cell-keyboard-edit state, including first-key replacement tracking. */
export type CellEditState = {
  arrayId: number
  index: number
  hasTyped: boolean
}

/** Origin and additive-selection mode for an active marquee gesture. */
export type MarqueeDrag = {
  startX: number
  startY: number
  additive: boolean
}

/** Canvas-space rectangle drawn during marquee selection. */
export type SelectionBox = {
  x: number
  y: number
  width: number
  height: number
}
