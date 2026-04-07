import { useRef, type ReactNode } from 'react';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import type { LayoutItem, WidgetId, Breakpoint, BreakpointLayouts } from '../types';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface WidgetEntry {
  id: WidgetId;
  node: ReactNode;
}

interface DashboardGridProps {
  widgets: WidgetEntry[];
  layouts: BreakpointLayouts;
  editMode: boolean;
  onLayoutChange: (breakpoint: Breakpoint, layout: LayoutItem[]) => void;
}

export default function DashboardGrid({ widgets, layouts, editMode, onLayoutChange }: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const currentBreakpoint = useRef<Breakpoint>('lg');

  return (
    <div ref={containerRef}>
      {mounted && (
        <ResponsiveGridLayout
          className={`dashboard-grid ${editMode ? 'edit-mode' : ''}`}
          width={width}
          layouts={layouts}
          breakpoints={{ lg: 900, md: 600, sm: 0 }}
          cols={{ lg: 3, md: 2, sm: 1 }}
          rowHeight={100}
          margin={[20, 20] as const}
          dragConfig={{
            enabled: editMode,
            handle: '.drag-handle',
          }}
          resizeConfig={{
            enabled: editMode,
          }}
          onBreakpointChange={(bp: string) => {
            currentBreakpoint.current = bp as Breakpoint;
          }}
          onLayoutChange={(current: Layout) => {
            onLayoutChange(currentBreakpoint.current, current as LayoutItem[]);
          }}
        >
          {widgets.map(({ id, node }) => (
            <div key={id} className="grid-widget">
              {editMode && (
                <div className="drag-handle">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" opacity="0.5">
                    <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
                    <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
                    <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
                  </svg>
                </div>
              )}
              {node}
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
