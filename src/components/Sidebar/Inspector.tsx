import React from 'react'
import { iteratorColors } from '../../constants/sketch'
import type { SketchElement } from '../../types/sketch'
import {
  getArrayEditorValue,
  parseArrayEditorValue,
  parseMatrixEditorValue,
} from '../../utils/canvas'

/** Selected sketch item and callbacks for editing or deleting it. */
export type InspectorProps = {
  selected?: SketchElement
  onUpdateSelected: (patch: Partial<SketchElement>) => void
  onDeleteElement: (id: number) => void
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
    return <div className="empty-inspector">Select an element to edit it</div>
  }

  return (
    <div className="inspector">
      <div className="section-label">SELECTED ELEMENT</div>
      {selected.kind !== 'node' && (
        <div className="field-row">
          <label htmlFor="label">Label</label>
          <input
            id="label"
            value={selected.label || ''}
            onChange={(event) => onUpdateSelected({ label: event.target.value })}
          />
        </div>
      )}
      {selected.kind !== 'iterator' && (
        <div className="field-row">
          <label htmlFor="value">Value</label>
          <textarea
            id="value"
            value={selected.kind === 'array' ? getArrayEditorValue(selected) : selected.value}
            onChange={(event) =>
              selected.kind === 'array'
                ? selected.layout === 'matrix'
                  ? onUpdateSelected(parseMatrixEditorValue(event.target.value))
                  : onUpdateSelected({
                      values: parseArrayEditorValue(event.target.value, selected.layout),
                    })
                : onUpdateSelected({ value: event.target.value })
            }
          />
        </div>
      )}
      {selected.kind === 'array' && (
        <p className="field-help">
          {selected.layout === 'map'
            ? 'One key: value pair per line'
            : selected.layout === 'vertical'
              ? 'One value per line'
              : selected.layout === 'matrix'
                ? 'Comma-separated values per row'
                : 'Separate values with commas'}
        </p>
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
      <button className="delete-button" onClick={() => onDeleteElement(selected.id)}>
        Delete element <span>⌫</span>
      </button>
    </div>
  )
}
