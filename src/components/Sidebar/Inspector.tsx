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
  const isCollection = isSketchCollection(selected)
  const layout = isCollection ? getCollectionLayout(selected) : null

  return (
    <div className="inspector">
      <div className="section-label">SELECTED ELEMENT</div>
      {(selected.kind === 'variable' || isCollection) && (
        <div className="field-row">
          <label htmlFor="label">Label</label>
          <input
            id="label"
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
        <p className="field-help">
          {layout === 'map'
            ? 'One key: value pair per line'
            : layout === 'vertical'
              ? 'One value per line'
              : layout === 'matrix'
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
