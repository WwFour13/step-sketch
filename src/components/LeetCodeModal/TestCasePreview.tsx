import React from 'react'
import type { ParsedTestCase } from '../../services/leetcode'

/** Test-case data and selection controls for a single preview card. */
export type TestCasePreviewProps = {
  testCase: ParsedTestCase
  caseNumber: number
  isSelected: boolean
  onToggle: () => void
}

/**
 * Renders one selectable case, choosing a compact preview for its scalar,
 * array, matrix, or linked-list inputs.
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

          if (testCase.hasLinkedListInput && Array.isArray(value)) {
            return (
              <div key={index} className="preview-item">
                <div className="preview-label">{name || 'head'}</div>
                <div className="preview-linked-list">
                  <div className="preview-head-indicator" title="Iterator on head">
                    ▼
                  </div>
                  {value.length === 0 ? (
                    <span className="preview-empty">∅ null</span>
                  ) : (
                    value.map((item, nodeIndex) => (
                      <React.Fragment key={nodeIndex}>
                        <div className="preview-node">{String(item)}</div>
                        {nodeIndex < value.length - 1 && <span className="preview-arrow">→</span>}
                      </React.Fragment>
                    ))
                  )}
                </div>
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
