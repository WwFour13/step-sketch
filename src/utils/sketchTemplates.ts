import { CELL_SIZE, NODE_SIZE, iteratorColors } from '../constants/sketch'
import type {
  Position,
  SketchElement,
  SketchIterator,
  SketchNode,
} from '../types/sketch'

export type TemplateKind =
  | 'variable'
  | 'node'
  | 'array'
  | 'string'
  | 'linked-list'
  | 'set'
  | 'map'
  | 'binary-tree'
  | 'matrix'

export type TemplateDefinition = {
  kind: TemplateKind
  icon: string
  label: string
  title: string
  size: { width: number; height: number }
}

export const TEMPLATE_DEFINITIONS: Record<TemplateKind, TemplateDefinition> = {
  variable: {
    kind: 'variable',
    icon: '□',
    label: 'Variable',
    title: 'single square',
    size: { width: NODE_SIZE, height: NODE_SIZE },
  },
  array: {
    kind: 'array',
    icon: '[]',
    label: 'Array',
    title: '[ 1, 4, 9, 16 ]',
    size: { width: 4 * CELL_SIZE, height: CELL_SIZE },
  },
  'linked-list': {
    kind: 'linked-list',
    icon: '→→',
    label: 'Linked list',
    title: '1 → 2 → 3',
    size: { width: 2 * 120 + NODE_SIZE, height: NODE_SIZE + 20 },
  },
  set: {
    kind: 'set',
    icon: '∪',
    label: 'Set',
    title: 'vertical unique values',
    size: { width: CELL_SIZE, height: 4 * CELL_SIZE },
  },
  matrix: {
    kind: 'matrix',
    icon: '▦',
    label: 'Matrix',
    title: '2D array / matrix',
    size: { width: 3 * CELL_SIZE, height: 3 * CELL_SIZE },
  },
  node: {
    kind: 'node',
    icon: '→',
    label: 'Node',
    title: 'pointer target',
    size: { width: NODE_SIZE, height: NODE_SIZE },
  },
  string: {
    kind: 'string',
    icon: 'Aa',
    label: 'String',
    title: '"algo" as cells',
    size: { width: 4 * CELL_SIZE, height: CELL_SIZE },
  },
  'binary-tree': {
    kind: 'binary-tree',
    icon: '⋔',
    label: 'Binary tree',
    title: '7 connected nodes',
    size: { width: 444, height: 314 },
  },
  map: {
    kind: 'map',
    icon: '↔',
    label: 'Map',
    title: 'key / value pairs',
    size: { width: CELL_SIZE * 2, height: 3 * CELL_SIZE },
  },
}

export type TemplateBuildResult = {
  elements: SketchElement[]
  nextId: number
  primaryId: number
  allElementIds: number[]
}

/**
 * Creates standard sketch elements for a given template kind placed at the given canvas position.
 */
export const createTemplateElements = (
  kind: TemplateKind,
  nextId: number,
  position: Position,
  iteratorCount: number = 0,
): TemplateBuildResult => {
  switch (kind) {
    case 'variable': {
      const id = nextId
      const value = String(Math.floor(Math.random() * 10))
      const element: SketchElement = {
        id,
        kind: 'variable',
        label: 'variable',
        value,
        position,
      }
      return {
        elements: [element],
        nextId: nextId + 1,
        primaryId: id,
        allElementIds: [id],
      }
    }
    case 'node': {
      const id = nextId
      const value = String(Math.floor(Math.random() * 10))
      const element: SketchElement = {
        id,
        kind: 'node',
        value,
        pointer_ids: [],
        pointer_limit: '+',
        position,
      }
      return {
        elements: [element],
        nextId: nextId + 1,
        primaryId: id,
        allElementIds: [id],
      }
    }
    case 'array': {
      const id = nextId
      const values = ['1', '4', '9', '16']
      const elementIds = values.map((_, index) => id + index + 1)
      const element: SketchElement = {
        id,
        kind: 'array',
        label: 'array',
        input_type: 'number',
        element_ids: elementIds,
        values,
        position,
      }
      return {
        elements: [element],
        nextId: nextId + values.length + 1,
        primaryId: id,
        allElementIds: [id, ...elementIds],
      }
    }
    case 'string': {
      const id = nextId
      const values = ['a', 'l', 'g', 'o']
      const elementIds = values.map((_, index) => id + index + 1)
      const element: SketchElement = {
        id,
        kind: 'array',
        label: 'text',
        input_type: 'character',
        element_ids: elementIds,
        values,
        position,
      }
      return {
        elements: [element],
        nextId: nextId + values.length + 1,
        primaryId: id,
        allElementIds: [id, ...elementIds],
      }
    }
    case 'set': {
      const id = nextId
      const values = ['2', '7', '11', '15']
      const elementIds = values.map((_, index) => id + index + 1)
      const element: SketchElement = {
        id,
        kind: 'set',
        label: 'set',
        element_ids: elementIds,
        values,
        position,
      }
      return {
        elements: [element],
        nextId: nextId + values.length + 1,
        primaryId: id,
        allElementIds: [id, ...elementIds],
      }
    }
    case 'map': {
      const id = nextId
      const values = ['name', 'Ada', 'role', 'coder', 'level', '42']
      const elementIds = values.map((_, index) => id + index + 1)
      const element: SketchElement = {
        id,
        kind: 'map',
        label: 'map',
        element_ids: elementIds,
        values,
        position,
      }
      return {
        elements: [element],
        nextId: nextId + values.length + 1,
        primaryId: id,
        allElementIds: [id, ...elementIds],
      }
    }
    case 'matrix': {
      const id = nextId
      const values = Array.from({ length: 9 }, (_, index) => String(index + 1))
      const element_ids = [0, 1, 2].map((row) =>
        values.slice(row * 3, row * 3 + 3).map((_, column) => id + row * 3 + column + 1),
      )
      const element: SketchElement = {
        id,
        kind: 'matrix',
        label: 'matrix',
        element_ids,
        values: [values.slice(0, 3), values.slice(3, 6), values.slice(6, 9)],
        position,
        columns: 3,
      }
      return {
        elements: [element],
        nextId: nextId + values.length + 1,
        primaryId: id,
        allElementIds: [id, ...element_ids.flat()],
      }
    }
    case 'linked-list': {
      const firstId = nextId
      const nodes: SketchNode[] = [0, 1, 2].map((index) => ({
        id: firstId + index,
        kind: 'node',
        value: String(index + 1),
        pointer_ids: index < 2 ? [firstId + index + 1] : [],
        pointer_limit: 1,
        position: { x: position.x + index * 120, y: position.y },
      }))
      const iteratorId = firstId + nodes.length
      const iterator: SketchIterator = {
        id: iteratorId,
        kind: 'iterator',
        hostId: firstId,
        color: iteratorColors[iteratorCount % iteratorColors.length],
        mode: 'bottom',
        label: 'head',
      }
      return {
        elements: [...nodes, iterator],
        nextId: firstId + nodes.length + 1,
        primaryId: firstId,
        allElementIds: nodes.map((n) => n.id),
      }
    }
    case 'binary-tree': {
      const firstId = nextId
      const positions = [
        { x: 330, y: 110 },
        { x: 200, y: 240 },
        { x: 460, y: 240 },
        { x: 135, y: 370 },
        { x: 265, y: 370 },
        { x: 395, y: 370 },
        { x: 525, y: 370 },
      ]
      const minX = 135
      const minY = 110
      const nodes: SketchNode[] = [0, 1, 2, 3, 4, 5, 6].map((index) => {
        const leftId = firstId + index * 2 + 1
        const rightId = firstId + index * 2 + 2
        const pointerIds = [leftId, rightId].filter((pointerId) => pointerId < firstId + 7)
        return {
          id: firstId + index,
          kind: 'node',
          value: String(index + 1),
          pointer_ids: pointerIds,
          pointer_limit: 2,
          position: {
            x: position.x + (positions[index].x - minX),
            y: position.y + (positions[index].y - minY),
          },
        }
      })
      return {
        elements: nodes,
        nextId: firstId + nodes.length,
        primaryId: firstId,
        allElementIds: nodes.map((n) => n.id),
      }
    }
  }
}

