import React from 'react'
import type { ParsedTestCase } from '../../services/leetcode'

const getBinaryTreeLevels = (values: unknown[]): unknown[][] => {
  if (values.length === 0 || values[0] === null) return []

  const levels: unknown[][] = [[values[0]]]
  let parents = [0]
  let childIndex = 1

  while (parents.length > 0 && childIndex < values.length) {
    const nextParents: number[] = []
    const children: unknown[] = []

    parents.forEach(() => {
      for (let side = 0; side < 2; side += 1) {
        if (childIndex >= values.length) break
        const index = childIndex
        const child = values[childIndex]
        childIndex += 1
        children.push(child)
        if (child !== null) nextParents.push(index)
      }
    })

    if (children.length > 0) levels.push(children)
    parents = nextParents
  }

  return levels
}

/** Test-case data and selection controls for a single preview card. */
export type TestCasePreviewProps = {
  testCase: ParsedTestCase
  caseNumber: number
  isSelected: boolean
  onToggle: () => void
}

/**
 * Renders one selectable case, choosing a compact preview for its scalar,
 * array, matrix, or node-structure inputs.
 */
export const TestCasePreview: React.FC<TestCasePreviewProps> = ({
  testCase,
  caseNumber,
  isSelected,
  onToggle,
}) => {
  return (
    <div
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
      className={`testcase-card ${isSelected ? 'selected' : ''}`}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          onToggle()
        }
      }}
    >
      <div className="testcase-card-header">
        <div className="testcase-title">Case {caseNumber}</div>
        <div className={`testcase-checkbox ${isSelected ? 'checked' : ''}`}>
          {isSelected && (
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="check-icon"
            >
              <polyline points="3.5 8.5 6.5 11.5 12.5 5" />
            </svg>
          )}
        </div>
      </div>

      <div className="testcase-card-body">
        {testCase.parsedInputs.map((input, index) => {
          const { name, value } = input

          if (input.nodeStructure === 'linked-list' && (Array.isArray(value) || value === null)) {
            const nodes = Array.isArray(value) ? value : []
            return (
              <div key={index} className="preview-item">
                <div className="preview-label">{name || 'head'}</div>
                <div className="preview-linked-list">
                  <div className="preview-head-indicator" title="Iterator on head">
                    ▼
                  </div>
                  {nodes.length === 0 ? (
                    <span className="preview-empty">∅ null</span>
                  ) : (
                    nodes.map((item, nodeIndex) => (
                      <React.Fragment key={nodeIndex}>
                        <div className="preview-node">{String(item)}</div>
                        {nodeIndex < nodes.length - 1 && <span className="preview-arrow">→</span>}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>
            )
          }

          if (input.nodeStructure === 'binary-tree' && Array.isArray(value)) {
            const levels = getBinaryTreeLevels(value)
            return (
              <div key={index} className="preview-item">
                <div className="preview-label">{name}</div>
                {levels.length === 0 ? (
                  <span className="preview-empty">∅ null</span>
                ) : (
                  <div className="preview-tree" aria-label="Binary tree">
                    {levels.map((level, levelIndex) => (
                      <div className="preview-tree-level" key={levelIndex}>
                        {level.map((node, nodeIndex) => (
                          <span
                            className={`preview-tree-node${node === null ? ' empty' : ''}`}
                            key={nodeIndex}
                          >
                            {node === null ? '·' : String(node)}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          if (
            input.nodeStructure === 'graph' &&
            Array.isArray(value) &&
            value.every(Array.isArray)
          ) {
            const radius = Math.max(28, value.length * 13)
            const center = radius + 15
            const graphSize = center * 2
            const positions = value.map((_, nodeIndex) => {
              const angle = (2 * Math.PI * nodeIndex) / Math.max(1, value.length) - Math.PI / 2
              return {
                x: center + radius * Math.cos(angle),
                y: center + radius * Math.sin(angle),
              }
            })
            const seenEdges = new Set<string>()
            const edges = value.flatMap((neighbors, nodeIndex) =>
              neighbors.flatMap((neighbor) => {
                if (
                  typeof neighbor !== 'number' ||
                  !Number.isInteger(neighbor) ||
                  neighbor < 1 ||
                  neighbor > value.length
                ) {
                  return []
                }
                const target = neighbor - 1
                const source = Math.min(nodeIndex, target)
                const edgeTarget = Math.max(nodeIndex, target)
                const edgeKey = `${source}-${edgeTarget}`
                if (seenEdges.has(edgeKey)) return []
                seenEdges.add(edgeKey)
                return [{ source, target: edgeTarget }]
              }),
            )

            return (
              <div key={index} className="preview-item">
                <div className="preview-label">{name}</div>
                {value.length === 0 ? (
                  <span className="preview-empty">∅</span>
                ) : (
                  <svg
                    className="preview-graph"
                    viewBox={`0 0 ${graphSize} ${graphSize}`}
                    role="img"
                    aria-label="Graph with nodes and connecting edges"
                  >
                    {edges.map(({ source, target }) => {
                      const from = positions[source]
                      const to = positions[target]
                      if (source === target) {
                        return (
                          <path
                            className="preview-graph-edge"
                            d={`M ${from.x - 5} ${from.y - 9} C ${from.x - 22} ${from.y - 30}, ${from.x + 22} ${from.y - 30}, ${from.x + 5} ${from.y - 9}`}
                            key={`${source}-${target}`}
                          />
                        )
                      }
                      const dx = to.x - from.x
                      const dy = to.y - from.y
                      const distance = Math.hypot(dx, dy)
                      const offsetX = (dx / distance) * 12
                      const offsetY = (dy / distance) * 12
                      return (
                        <line
                          className="preview-graph-edge"
                          key={`${source}-${target}`}
                          x1={from.x + offsetX}
                          y1={from.y + offsetY}
                          x2={to.x - offsetX}
                          y2={to.y - offsetY}
                        />
                      )
                    })}
                    {positions.map(({ x, y }, nodeIndex) => (
                      <g key={nodeIndex}>
                        <circle className="preview-graph-node" cx={x} cy={y} r="12" />
                        <text className="preview-graph-label" x={x} y={y}>
                          {nodeIndex + 1}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            )
          }

          if (typeof value === 'string') {
            const characters = Array.from(value)
            return (
              <div key={index} className="preview-item">
                <div className="preview-label">{name}</div>
                <div className="preview-array-cells">
                  {characters.map((char, charIndex) => (
                    <div key={charIndex} className="preview-cell">
                      {char}
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          if (Array.isArray(value)) {
            // 2D Array / Matrix
            if (value.length > 0 && value.every(Array.isArray)) {
              return (
                <div key={index} className="preview-item">
                  <div className="preview-label">{name}</div>
                  <div className="preview-matrix">
                    {value.map((row, rowIndex) => (
                      <div key={rowIndex} className="preview-array-cells">
                        {(row as unknown[]).map((cell, cellIndex) => (
                          <div key={cellIndex} className="preview-cell">
                            {String(cell)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            // 1D Array
            return (
              <div key={index} className="preview-item">
                <div className="preview-label">{name}</div>
                <div className="preview-array-cells">
                  {value.length === 0 ? (
                    <span className="preview-empty">[ ]</span>
                  ) : (
                    value.map((item, itemIndex) => (
                      <div key={itemIndex} className="preview-cell">
                        {String(item)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          }

          // Variable / Primitive
          return (
            <div key={index} className="preview-item">
              <div className="preview-label">{name}</div>
              <div className="preview-variable-square">
                <span>{String(value)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
