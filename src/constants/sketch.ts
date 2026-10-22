import type {
  CanvasDimensions,
  CanvasDocument,
  CanvasState,
  CanvasViewport,
  IteratorColor,
  IteratorMode,
  PointerLimit,
  SketchElement,
} from '../types/sketch'

/** Shared canvas dimensions used by bounds, layout, and rendering helpers. */
export const NODE_RADIUS = 27
export const NODE_SIZE = 54
export const CELL_SIZE = 42
export const MAP_CELL_WIDTH = CELL_SIZE * 2

/** Hardcoded 16:9 canvas aspect ratio. */
export const CANVAS_ASPECT_RATIO_X = 16
export const CANVAS_ASPECT_RATIO_Y = 9
export const CANVAS_ASPECT_RATIO = CANVAS_ASPECT_RATIO_X / CANVAS_ASPECT_RATIO_Y

/** Default logical canvas boundaries (world space) hardcoded to 16:9 ratio. */
export const DEFAULT_CANVAS_DIMENSIONS: CanvasDimensions = {
  width: 3200,
  height: 1800,
}

/** Default viewport camera values. */
export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = {
  zoom: 1,
  pan: { x: 0, y: 0 },
}

export const MIN_CANVAS_ZOOM = 0.5
export const MAX_CANVAS_ZOOM = 2.0
export const CANVAS_PAN_MARGIN = 200

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
    input_type: 'number',
    element_ids: [2, 3, 4, 5],
    values: ['2', '7', '11', '15'],
    position: { x: 88, y: 150 },
  },
  {
    id: 6,
    kind: 'array',
    label: 'word',
    input_type: 'character',
    element_ids: [7, 8, 9, 10, 11, 12, 13, 14],
    values: ['l', 'e', 'e', 't', 'c', 'o', 'd', 'e'],
    position: { x: 388, y: 338 },
  },
]

export const initialCanvasDocument: CanvasDocument = {
  version: 1,
  dimensions: DEFAULT_CANVAS_DIMENSIONS,
  nextId: 15,
  elements: initialElements,
}

export const initialCanvasState: CanvasState = {
  document: initialCanvasDocument,
  viewport: DEFAULT_CANVAS_VIEWPORT,
}

