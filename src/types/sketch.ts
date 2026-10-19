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

/** Shared metadata for cell-based collections. */
type SketchCollectionBase = {
  id: number
  label: string
  position: Position
}

export type SketchArrayInputType = 'number' | 'character'

/** One-dimensional array with stable cell IDs for pointers and iterators. */
export type SketchArray = SketchCollectionBase & {
  kind: 'array'
  input_type: SketchArrayInputType
  element_ids: number[]
  values: string[]
}

/** Vertical one-dimensional collection with unique values. */
export type SketchSet = SketchCollectionBase & {
  kind: 'set'
  element_ids: number[]
  values: string[]
}

/** Key/value collection stored as alternating key and value cells. */
export type SketchMap = SketchCollectionBase & {
  kind: 'map'
  element_ids: number[]
  values: string[]
}

/** Two-dimensional matrix whose values and cell IDs retain row structure. */
export type SketchMatrix = SketchCollectionBase & {
  kind: 'matrix'
  element_ids: number[][]
  values: string[][]
  columns: number
}

export type SketchCollection = SketchArray | SketchSet | SketchMap | SketchMatrix

/** Pointer node with references to other node IDs and no user-facing label. */
export type SketchNode = Omit<SketchVariable, 'kind' | 'label'> & {
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
export type SketchElement = SketchVariable | SketchCollection | SketchNode | SketchIterator

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
  insertBefore?: boolean
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

/** Active matrix resize gesture state showing target dimensions. */
export type MatrixResizeState = {
  id: number
  targetColumns: number
  targetRows: number
}
