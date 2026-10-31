import React from 'react'
import type { SketchArrayInputType } from '../../types/sketch'
import type { TemplateKind } from '../../utils/sketchTemplates'

/** Element-creation callbacks and import status consumed by the tool palette. */
export type ToolSectionProps = {
  onAddVariable: (kind: 'variable' | 'node') => void
  onAddArray: (values: string[], label: string, inputType?: SketchArrayInputType) => void
  onAddLinkedList: () => void
  onAddSet: () => void
  onAddMap: () => void
  onAddBinaryTree: () => void
  onAddMatrix: () => void
  onOpenLeetCodeModal: () => void
  onStartTemplateDrag?: (event: React.PointerEvent, kind: TemplateKind) => void
  wasTemplateJustDragged?: () => boolean
}

/**
 * Renders the canvas template buttons and forwards each action to the owning
 * application state handler.
 */
export const ToolSection: React.FC<ToolSectionProps> = ({
  onAddVariable,
  onAddArray,
  onAddLinkedList,
  onAddSet,
  onAddMap,
  onAddBinaryTree,
  onAddMatrix,
  onOpenLeetCodeModal,
  onStartTemplateDrag,
  wasTemplateJustDragged,
}) => {
  const handleTemplateClick = (callback: () => void) => {
    if (wasTemplateJustDragged?.()) return
    callback()
  }

  return (
    <div className="tool-section">
      <div className="section-label">ADD TO CANVAS</div>
      <div className="template-list">
        {/* Column 1 items (rows 1-5) */}
        <button
          className="template-button"
          title="single square"
          draggable={false}
          onPointerDown={(event) => onStartTemplateDrag?.(event, 'variable')}
          onClick={() => handleTemplateClick(() => onAddVariable('variable'))}
        >
          <span className="template-icon">□</span>
          <span className="template-copy">
            <strong>Variable</strong>
          </span>
        </button>
        <button
          className="template-button"
          title="[ 1, 4, 9, 16 ]"
          draggable={false}
          onPointerDown={(event) => onStartTemplateDrag?.(event, 'array')}
          onClick={() =>
            handleTemplateClick(() => onAddArray(['1', '4', '9', '16'], 'array', 'number'))
          }
        >
          <span className="template-icon">[]</span>
          <span className="template-copy">
            <strong>Array</strong>
          </span>
        </button>
        <button
          className="template-button"
          title="1 → 2 → 3"
          draggable={false}
          onPointerDown={(event) => onStartTemplateDrag?.(event, 'linked-list')}
          onClick={() => handleTemplateClick(onAddLinkedList)}
        >
          <span className="template-icon">→→</span>
          <span className="template-copy">
            <strong>Linked list</strong>
          </span>
        </button>
        <button
          className="template-button"
          title="vertical unique values"
          draggable={false}
          onPointerDown={(event) => onStartTemplateDrag?.(event, 'set')}
          onClick={() => handleTemplateClick(onAddSet)}
        >
          <span className="template-icon">∪</span>
          <span className="template-copy">
            <strong>Set</strong>
          </span>
        </button>
        <button
          className="template-button"
          title="2D array / matrix"
          draggable={false}
          onPointerDown={(event) => onStartTemplateDrag?.(event, 'matrix')}
          onClick={() => handleTemplateClick(onAddMatrix)}
        >
          <span className="template-icon">▦</span>
          <span className="template-copy">
            <strong>Matrix</strong>
          </span>
        </button>

        {/* Column 2 items (rows 1-5) */}
        <button
          className="template-button"
          title="pointer target"
          draggable={false}
          onPointerDown={(event) => onStartTemplateDrag?.(event, 'node')}
          onClick={() => handleTemplateClick(() => onAddVariable('node'))}
        >
          <span className="template-icon">→</span>
          <span className="template-copy">
            <strong>Node</strong>
          </span>
        </button>
        <button
          className="template-button"
          title='"algo" as cells'
          draggable={false}
          onPointerDown={(event) => onStartTemplateDrag?.(event, 'string')}
          onClick={() =>
            handleTemplateClick(() => onAddArray(['a', 'l', 'g', 'o'], 'text', 'character'))
          }
        >
          <span className="template-icon">Aa</span>
          <span className="template-copy">
            <strong>String</strong>
          </span>
        </button>
        <button
          className="template-button"
          title="7 connected nodes"
          draggable={false}
          onPointerDown={(event) => onStartTemplateDrag?.(event, 'binary-tree')}
          onClick={() => handleTemplateClick(onAddBinaryTree)}
        >
          <span className="template-icon">⋔</span>
          <span className="template-copy">
            <strong>Binary tree</strong>
          </span>
        </button>
        <button
          className="template-button"
          title="key / value pairs"
          draggable={false}
          onPointerDown={(event) => onStartTemplateDrag?.(event, 'map')}
          onClick={() => handleTemplateClick(onAddMap)}
        >
          <span className="template-icon">↔</span>
          <span className="template-copy">
            <strong>Map</strong>
          </span>
        </button>
        <button
          className="template-button"
          title="Import LeetCode problem test cases"
          onClick={onOpenLeetCodeModal}
        >
          <span className="template-icon">#</span>
          <span className="template-copy">
            <strong>LeetCode</strong>
          </span>
        </button>
      </div>
    </div>
  )
}
