import React, { useEffect, useRef, useState } from 'react'
import {
  fetchLeetCodeProblemDetails,
  type LeetCodeProblemDetail,
  type ParsedTestCase,
} from '../../services/leetcode'
import './LeetCodeModal.css'
import { TestCasePreview } from './TestCasePreview'

export type LeetCodeModalProps = {
  isOpen: boolean
  onClose: () => void
  onImport: (selectedCases: ParsedTestCase[], problemTitle: string) => void
  initialProblemNumber?: string
}

export const LeetCodeModal: React.FC<LeetCodeModalProps> = ({
  isOpen,
  onClose,
  onImport,
  initialProblemNumber = '1',
}) => {
  const [problemNumber, setProblemNumber] = useState(initialProblemNumber)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [problemDetail, setProblemDetail] = useState<LeetCodeProblemDetail | null>(null)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleLoad = async () => {
    const trimmed = problemNumber.trim()
    if (!trimmed) {
      setErrorMessage('Enter problem #')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    try {
      const details = await fetchLeetCodeProblemDetails(trimmed)
      setProblemDetail(details)
      // Default to having only case 1 selected
      setSelectedIndices(new Set(details.testCases.length > 0 ? [0] : []))
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error loading problem')
      setProblemDetail(null)
      setSelectedIndices(new Set())
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation()
    if (event.key === 'Enter') {
      event.preventDefault()
      handleLoad()
    }
  }

  const handleToggleCase = (index: number) => {
    setSelectedIndices((current) => {
      const next = new Set(current)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (!problemDetail) return
    setSelectedIndices(new Set(problemDetail.testCases.map((_, index) => index)))
  }

  const handleClearAll = () => {
    setSelectedIndices(new Set())
  }

  const handleConfirm = () => {
    if (!problemDetail) return
    const selectedCases = problemDetail.testCases.filter((_, index) => selectedIndices.has(index))
    if (selectedCases.length === 0) return
    onImport(selectedCases, problemDetail.title)
    onClose()
  }

  return (
    <div className="leetcode-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="leetcode-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leetcode-modal-heading"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="leetcode-modal-header">
          <div id="leetcode-modal-heading" className="leetcode-modal-title">
            <span className="hash-icon">#</span>
            <span>LeetCode Import</span>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="leetcode-modal-search-row">
          <div className="leetcode-input-group">
            <input
              id="problem-number"
              ref={inputRef}
              type="number"
              min="1"
              className="leetcode-number-input"
              placeholder="e.g. 1"
              value={problemNumber}
              onChange={(event) => setProblemNumber(event.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={isLoading}
              aria-label="LeetCode problem number"
            />
            <button
              type="button"
              className="leetcode-load-btn"
              onClick={handleLoad}
              disabled={isLoading}
            >
              {isLoading ? '...' : 'Load'}
            </button>
          </div>

          <div className="problem-meta-inline">
            {problemDetail ? (
              <>
                <span
                  className="problem-title-text"
                  title={`#${problemDetail.questionId}. ${problemDetail.title}`}
                >
                  #{problemDetail.questionId}. {problemDetail.title}
                </span>
                {problemDetail.description && (
                  <span className="problem-description-text" title={problemDetail.description}>
                    — {problemDetail.description}
                  </span>
                )}
                <span className="problem-case-count">
                  {problemDetail.testCases.length}{' '}
                  {problemDetail.testCases.length === 1 ? 'testcase' : 'testcases'} available
                </span>
              </>
            ) : errorMessage ? (
              <span className="leetcode-modal-error-inline">{errorMessage}</span>
            ) : (
              <span className="problem-hint-inline">Enter problem number and press Load</span>
            )}
          </div>
        </div>

        {problemDetail && problemDetail.testCases.length > 0 && (
          <div className="testcases-section-heading">
            <span>Select test cases:</span>
            <div className="selection-actions">
              <button type="button" className="action-link-btn" onClick={handleSelectAll}>
                Select all
              </button>
              <button type="button" className="action-link-btn" onClick={handleClearAll}>
                Deselect all
              </button>
            </div>
          </div>
        )}

        <div className="testcases-list">
          {!problemDetail && !errorMessage && !isLoading && (
            <div className="testcases-empty">
              Enter a LeetCode problem number above and press <strong>Load</strong>.
            </div>
          )}

          {problemDetail && problemDetail.testCases.length === 0 && (
            <div className="testcases-empty">No test cases found for this problem.</div>
          )}

          {problemDetail &&
            problemDetail.testCases.map((testCase, index) => (
              <TestCasePreview
                key={index}
                testCase={testCase}
                caseNumber={index + 1}
                isSelected={selectedIndices.has(index)}
                onToggle={() => handleToggleCase(index)}
              />
            ))}
        </div>

        <div className="leetcode-modal-footer">
          <div className="footer-summary">
            {problemDetail
              ? `${selectedIndices.size} of ${problemDetail.testCases.length} selected`
              : ''}
          </div>
          <div className="footer-buttons">
            <button type="button" className="modal-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="modal-ok-btn"
              onClick={handleConfirm}
              disabled={selectedIndices.size === 0}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
