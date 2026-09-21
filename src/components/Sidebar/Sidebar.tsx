import React from 'react'
import type { SketchElement } from '../../types/sketch'
import { Inspector } from './Inspector'
import { ToolSection, type ToolSectionProps } from './ToolSection'

export type SidebarProps = ToolSectionProps & {
  selected?: SketchElement
  onUpdateSelected: (patch: Partial<SketchElement>) => void
  onDeleteElement: (id: number) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  selected,
  onUpdateSelected,
  onDeleteElement,
  ...toolSectionProps
}) => {
  return (
    <aside className="sidebar">
      <ToolSection {...toolSectionProps} />
      <Inspector
        selected={selected}
        onUpdateSelected={onUpdateSelected}
        onDeleteElement={onDeleteElement}
      />
      <div className="sidebar-footer">
        <button className="help-button">
          ? <span>Shortcuts</span>
          <kbd>⌘ /</kbd>
        </button>
        <span className="version">v1.0</span>
      </div>
    </aside>
  )
}
