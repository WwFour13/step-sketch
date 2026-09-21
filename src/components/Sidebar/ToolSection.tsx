import React from 'react'

export type ToolSectionProps = {
  onAddVariable: (kind: 'variable' | 'node') => void
  onAddArray: (values: string[], label: string) => void
  onAddLinkedList: () => void
  onAddSet: () => void
  onAddMap: () => void
  onAddBinaryTree: () => void
  problemNumber: string
  onProblemNumberChange: (value: string) => void
  onAddLeetCodeTestCase: () => void
  isLoadingProblem: boolean
  problemStatus: string
}

export const ToolSection: React.FC<ToolSectionProps> = ({
  onAddVariable,
  onAddArray,
  onAddLinkedList,
  onAddSet,
  onAddMap,
  onAddBinaryTree,
  problemNumber,
  onProblemNumberChange,
  onAddLeetCodeTestCase,
  isLoadingProblem,
  problemStatus,
}) => {
  return (
    <div className="tool-section">
      <div className="section-label">ADD TO CANVAS</div>
      <div className="template-list">
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
        <div className="template-button leetcode-import">
          <span className="template-icon">#</span>
          <strong className="leetcode-label">LeetCode</strong>
          <input
            id="problem-number"
            type="number"
            min="1"
            value={problemNumber}
            onChange={(event) => onProblemNumberChange(event.target.value)}
            aria-label="LeetCode problem number"
          />
          <button type="button" onClick={onAddLeetCodeTestCase} disabled={isLoadingProblem}>
            {isLoadingProblem ? '...' : 'Load'}
          </button>
        </div>
      </div>
      {problemStatus && <div className="problem-status">{problemStatus}</div>}
    </div>
  )
}
