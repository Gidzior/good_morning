# Dashboard Template — Metrica Light Theme

Reusable template for building dashboard applications with React + shadcn/ui + Tailwind CSS v4.

## Included Components

| Component | Description |
|-----------|-------------|
| `AppShell` | Top-level layout: sidebar + header + content area |
| `DashboardCard` | Card wrapper with icon, title, and optional column span |
| `DashboardHeader` | Header bar with sidebar trigger, greeting, and date/time |
| `AppSidebar` | Navigation sidebar with collapsible icon mode and refresh controls |

## Required shadcn Components

Install these before using the template:

```bash
npx shadcn@latest add card sidebar separator tooltip chart badge scroll-area button
```

## Theme Setup

1. Copy `theme/metrica-theme.css` to your project
2. Import it in your `index.css` or copy the `:root` variables
3. Register color mappings in your `@theme inline` block (see main project's `index.css` for reference)

## Quick Start

```tsx
import { AppShell } from './template/components/AppShell';
import AppSidebar from './components/AppSidebar';
import DashboardHeader from './components/DashboardHeader';
import DashboardCard from './components/DashboardCard';

export default function App() {
  return (
    <AppShell
      sidebar={<AppSidebar lastUpdate={new Date()} countdown="" onRefresh={() => {}} />}
      header={<DashboardHeader now={new Date()} />}
    >
      <div className="grid grid-cols-3 gap-5">
        <DashboardCard icon="📊" title="My Card">
          Content here
        </DashboardCard>
      </div>
    </AppShell>
  );
}
```

## Hooks

- `useRefresh(intervalMs)` — auto-refresh timer with countdown display

## Font

The theme uses **Roboto** as primary font. Add to your HTML:

```html
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
```

Or install via npm: `npm install @fontsource/roboto`

## Style: base-nova

The shadcn `components.json` must use `"style": "base-nova"` for compatibility with this template.
