import React from 'react'
import { iteratorColors, pointerLimits } from '../../constants/sketch'
import type { SketchElement } from '../../types/sketch'
import {
  getArrayEditorValue,
  parseArrayEditorValue,
  parseMatrixEditorValue,
} from '../../utils/canvas'
import { getCollectionLayout, isSketchCollection } from '../../utils/sketchCollections'

/** Selected sketch item and callbacks for editing or deleting it. */
export type InspectorProps = {
  selected?: SketchElement
  onUpdateSelected: (patch: Partial<SketchElement>) => void
  onDeleteElement: (id: number) => void
}

const getElementKindMeta = (element: SketchElement) => {
  if (element.kind === 'variable') {
    return { name: 'Variable', icon: '□' }
  }
  if (element.kind === 'node') {
    return { name: 'Node', icon: '○' }
  }
  if (element.kind === 'iterator') {
    return { name: 'Iterator', icon: '▲' }
  }
  if (isSketchCollection(element)) {
    const layout = getCollectionLayout(element)
    switch (layout) {
      case 'matrix':
        return { name: 'Matrix', icon: '▦' }
      case 'map':
        return { name: 'Map', icon: '↔' }
      case 'vertical':
        return { name: element.kind === 'set' ? 'Set' : 'Vertical Array', icon: '∪' }
      default:
        return {
          name: 'input_type' in element && element.input_type === 'character' ? 'String' : 'Array',
          icon: '[ ]',
        }
    }
  }
  return { name: 'Element', icon: '◇' }
}

/**
 * Displays editable fields tailored to the selected element kind, including
 * layout-aware array text and iterator color controls.
 */
export const Inspector: React.FC<InspectorProps> = ({
  selected,
  onUpdateSelected,
  onDeleteElement,
}) => {
  if (!selected) {
    return (
      <div className="inspector empty-inspector-container">
        <div className="section-label">INSPECTOR</div>
        <div className="empty-inspector-card">
          <div className="empty-inspector-icon">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M3 12h3m12 0h3M12 3v3m0 12v3" />
            </svg>
          </div>
          <div className="empty-inspector-text">
            <strong>No element selected</strong>
            <span>Click any item or cell on the canvas to inspect & edit</span>
          </div>
        </div>
      </div>
    )
  }

  const isCollection = isSketchCollection(selected)
  const layout = isCollection ? getCollectionLayout(selected) : null
  const meta = getElementKindMeta(selected)

  return (
    <div className="inspector">
      <div className="inspector-header">
        <span className="section-label">INSPECTOR</span>
        <span className="inspector-badge">
          <span className="badge-icon">{meta.icon}</span>
          <span className="badge-name">{meta.name}</span>
        </span>
      </div>

      {(selected.kind === 'variable' || isCollection) && (
        <div className="field-row">
          <label htmlFor="label">Label</label>
          <input
            id="label"
            placeholder="element label"
            value={selected.label || ''}
            onChange={(event) => onUpdateSelected({ label: event.target.value })}
          />
        </div>
      )}

      {selected.kind === 'node' && (
        <div className="field-row pointer-limit-field">
          <label>Pointer limit</label>
          <div className="pointer-limit-options" role="radiogroup" aria-label="Node pointer limit">
            {pointerLimits.map((limit) => (
              <label
                key={limit}
                className="pointer-limit-option"
                title={
                  limit === '+'
                    ? 'Unlimited pointers'
                    : `Up to ${limit} pointer${limit === 1 ? '' : 's'}`
                }
              >
                <input
                  type="radio"
                  name="pointer-limit"
                  value={limit}
                  checked={selected.pointer_limit === limit}
                  onChange={() => onUpdateSelected({ pointer_limit: limit })}
                />
                <span className="pointer-limit-radio">{limit}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {selected.kind === 'variable' || selected.kind === 'node' || isCollection ? (
        <div className="field-row">
          <label htmlFor="value">Value</label>
          <textarea
            id="value"
            rows={layout === 'matrix' || layout === 'map' ? 4 : 2}
            value={
              isCollection
                ? getArrayEditorValue(selected)
                : selected.kind === 'variable' || selected.kind === 'node'
                  ? selected.value
                  : ''
            }
            onChange={(event) =>
              isCollection
                ? layout === 'matrix'
                  ? onUpdateSelected(parseMatrixEditorValue(event.target.value))
                  : onUpdateSelected({
                      values: parseArrayEditorValue(event.target.value, layout ?? 'horizontal'),
                    })
                : onUpdateSelected({ value: event.target.value })
            }
          />
        </div>
      ) : null}

      {isCollection && (
        <div className="field-help-pill">
          <span className="help-icon">ℹ</span>
          <span>
            {layout === 'map'
              ? 'One key: value pair per line'
              : layout === 'vertical'
                ? 'One value per line'
                : layout === 'matrix'
                  ? 'Comma-separated values per row'
                  : 'Separate values with commas'}
          </span>
        </div>
      )}

      {selected.kind === 'iterator' && (
        <div className="field-row iterator-color-field">
          <label>Iterator color</label>
          <div className="iterator-color-options" role="radiogroup" aria-label="Iterator color">
            {iteratorColors.map((color) => (
              <label key={color} className="iterator-color-option" title={color}>
                <input
                  type="radio"
                  name="iterator-color"
                  value={color}
                  checked={selected.color === color}
                  onChange={() => onUpdateSelected({ color })}
                />
                <span className={`color-radio color-${color}`} />
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="delete-button"
        onClick={() => onDeleteElement(selected.id)}
      >
        <span>Delete element</span>
        <kbd>⌫</kbd>
      </button>
    </div>
  )
}
