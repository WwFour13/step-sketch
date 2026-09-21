import React from 'react'
import { NODE_RADIUS } from '../../constants/sketch'
import type { PointerDraft, SketchElement, SketchNode } from '../../types/sketch'
import { pointerEndpoints } from '../../utils/canvas'

export type PointerLayerProps = {
  elements: SketchElement[]
  pointerDraft: PointerDraft | null
  onRelationshipStart: (
    event: React.PointerEvent<SVGLineElement>,
    sourceId: number,
    targetId: number,
  ) => void
  onRelationshipFinish: (event: React.PointerEvent<SVGLineElement>) => void
}

export const PointerLayer: React.FC<PointerLayerProps> = ({
  elements,
  pointerDraft,
  onRelationshipStart,
  onRelationshipFinish,
}) => {
  const nodePosition = (id: number) =>
    elements.find((element): element is SketchNode => element.kind === 'node' && element.id === id)
      ?.position

  const draftSourcePosition = pointerDraft ? nodePosition(pointerDraft.sourceId) : undefined

  return (
    <svg className="pointer-layer" aria-hidden="true">
      <defs>
        <marker id="pointer-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>
      {elements
        .filter((element): element is SketchNode => element.kind === 'node')
        .flatMap((node) =>
          node.pointer_ids.map((pointerId) => {
            const target = nodePosition(pointerId)
            if (!target) return null
            const endpoints = pointerEndpoints(node.position, target)
            return (
              <line
                key={`${node.id}-${pointerId}`}
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
            )
          }),
        )}
      {pointerDraft && draftSourcePosition && (
        <line
          className="pointer-draft"
          {...pointerEndpoints(draftSourcePosition, {
            x: pointerDraft.x - NODE_RADIUS,
            y: pointerDraft.y - NODE_RADIUS,
          })}
        />
      )}
    </svg>
  )
}
