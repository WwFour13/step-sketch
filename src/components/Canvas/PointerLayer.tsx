import React from 'react'
import { NODE_RADIUS } from '../../constants/sketch'
import type { PointerDraft, SketchElement, SketchNode } from '../../types/sketch'
import { pointerEndpoints } from '../../utils/canvas'

/** Node data and callbacks needed to render stored and in-progress pointers. */
export type PointerLayerProps = {
  elements: SketchElement[]
  pointerDraft: PointerDraft | null
  onRelationshipStart: (
    event: React.PointerEvent<SVGLineElement>,
    sourceId: number,
    targetId: number,
  ) => void
  onRelationshipFinish: (event: React.PointerEvent<SVGLineElement>) => void
  getElementLevel?: (id: number) => number
}

/**
 * Draws node-to-node relationships and the temporary line being created by a
 * right-button drag from a node. Each pointer arrow is rendered at the stacking
 * level of its lowest edge node: Math.min(sourceLevel, targetLevel).
 */
export const PointerLayer: React.FC<PointerLayerProps> = ({
  elements,
  pointerDraft,
  onRelationshipStart,
  onRelationshipFinish,
  getElementLevel,
}) => {
  const nodePosition = (id: number) =>
    elements.find((element): element is SketchNode => element.kind === 'node' && element.id === id)
      ?.position

  const draftSourcePosition = pointerDraft ? nodePosition(pointerDraft.sourceId) : undefined
  const draftZIndex =
    pointerDraft && getElementLevel ? getElementLevel(pointerDraft.sourceId) : 10

  const relationships = elements
    .filter((element): element is SketchNode => element.kind === 'node')
    .flatMap((node) =>
      node.pointer_ids.map((pointerId) => {
        const target = nodePosition(pointerId)
        if (!target) return null
        const endpoints = pointerEndpoints(node.position, target)
        const sourceLevel = getElementLevel ? getElementLevel(node.id) : 10
        const targetLevel = getElementLevel ? getElementLevel(pointerId) : 10
        const zIndex = Math.min(sourceLevel, targetLevel)
        return {
          key: `${node.id}-${pointerId}`,
          node,
          pointerId,
          endpoints,
          zIndex,
        }
      }),
    )
    .filter((rel): rel is NonNullable<typeof rel> => rel !== null)

  return (
    <>
      {relationships.map(({ key, node, pointerId, endpoints, zIndex }) => (
        <svg
          key={key}
          className="pointer-layer"
          style={{ zIndex }}
          aria-hidden="true"
        >
          <defs>
            <marker id="pointer-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" />
            </marker>
          </defs>
          <line
            className="pointer-relationship"
            {...endpoints}
            markerEnd="url(#pointer-arrow)"
            onPointerDown={(event) => onRelationshipStart(event, node.id, pointerId)}
            onPointerUp={(event) => {
              onRelationshipFinish(event)
              event.stopPropagation()
            }}
            onLostPointerCapture={onRelationshipFinish}
          />
        </svg>
      ))}

      {pointerDraft && draftSourcePosition && (
        <svg
          className="pointer-layer"
          style={{ zIndex: draftZIndex }}
          aria-hidden="true"
        >
          <defs>
            <marker id="pointer-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" />
            </marker>
          </defs>
          <line
            className="pointer-draft"
            {...pointerEndpoints(draftSourcePosition, {
              x: pointerDraft.x - NODE_RADIUS,
              y: pointerDraft.y - NODE_RADIUS,
            })}
          />
        </svg>
      )}
    </>
  )
}
