import React from 'react'

export type ToolSectionProps = {
  onAddVariable: (kind: 'variable' | 'node') => void
  onAddArray: (values: string[], label: string) => void
  onAddLinkedList: () => void
  onAddSet: () => void
  onAddMap: () => void
  onAddBinaryTree: () => void
  onAddMatrix: () => void
  onOpenLeetCodeModal: () => void
  problemStatus: string
}

export const ToolSection: React.FC<ToolSectionProps> = ({
  onAddVariable,
  onAddArray,
  onAddLinkedList,
  onAddSet,
  onAddMap,
  onAddBinaryTree,
  onAddMatrix,
  onOpenLeetCodeModal,
  problemStatus,
}) => {
  return (
    <div className="tool-section">
      <div className="section-label">ADD TO CANVAS</div>
      <div className="template-list">
        {/* Column 1 items (rows 1-5) */}
        <button
          className="template-button"
          title="single square"
          onClick={() => onAddVariable('variable')}
        >
          <span className="template-icon">□</span>
          <span className="template-copy">
            <strong>Variable</strong>
          </span>
        </button>
        <button
          className="template-button"
          title="[ 1, 4, 9, 16 ]"
          onClick={() => onAddArray(['1', '4', '9', '16'], 'array')}
        >
          <span className="template-icon">[]</span>
          <span className="template-copy">
            <strong>Array</strong>
          </span>
        </button>
        <button className="template-button" title="1 → 2 → 3" onClick={onAddLinkedList}>
          <span className="template-icon">→→</span>
          <span className="template-copy">
            <strong>Linked list</strong>
          </span>
        </button>
        <button className="template-button" title="vertical unique values" onClick={onAddSet}>
          <span className="template-icon">∪</span>
          <span className="template-copy">
            <strong>Set</strong>
          </span>
        </button>
        <button className="template-button" title="2D array / matrix" onClick={onAddMatrix}>
          <span className="template-icon">▦</span>
          <span className="template-copy">
            <strong>Matrix</strong>
          </span>
        </button>

        {/* Column 2 items (rows 1-5) */}
        <button
          className="template-button"
          title="pointer target"
          onClick={() => onAddVariable('node')}
        >
          <span className="template-icon">→</span>
          <span className="template-copy">
            <strong>Node</strong>
          </span>
        </button>
        <button
          className="template-button"
          title='"algo" as cells'
          onClick={() => onAddArray(['a', 'l', 'g', 'o'], 'text')}
        >
          <span className="template-icon">Aa</span>
          <span className="template-copy">
            <strong>String</strong>
          </span>
        </button>
        <button className="template-button" title="7 connected nodes" onClick={onAddBinaryTree}>
          <span className="template-icon">⋔</span>
          <span className="template-copy">
            <strong>Binary tree</strong>
          </span>
        </button>
        <button className="template-button" title="key / value pairs" onClick={onAddMap}>
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
      {problemStatus && <div className="problem-status">{problemStatus}</div>}
    </div>
  )
}
