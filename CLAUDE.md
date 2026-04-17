# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server with HMR
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built bundle
- `npm run lint` — ESLint across `**/*.{js,jsx}` (flat config in `eslint.config.js`)

No test runner is configured.

## Stack

React 19 + React Router v7 + Vite 8, plain JSX (no TypeScript). Icons via `lucide-react`, font via `@fontsource/montserrat`, HTTP via `axios` (present as a dep but not yet wired — all data is currently mocked in-module).

## Architecture

This is a single-page internal CRM/ops console for a home automation installer ("intellix"). The product surface is a fixed sidebar + routed main panel; each sidebar entry maps to one top-level page component.

- `src/main.jsx` mounts `<App />` into `#root` with `StrictMode`.
- `src/App.jsx` owns the shell: the `NAV` array drives the sidebar (entries with `section` render as section headers, entries with `path`/`label`/`icon` render as `NavLink`s), and `<Routes>` maps each path to a page component. A local `dark` state toggles a `.dark` class on the root wrapper. Routes without a real component use the inline `Placeholder` in `App.jsx`.
- Page components live **flat** directly under `src/` (e.g. `Dashboard.jsx`, `JobsProposals.jsx`, `Clients.jsx`, `SupportTickets.jsx`, `Calendar.jsx`, `ComposerBuilds.jsx`, `DriverLibrary.jsx`, `Inventory.jsx`, `IntelixAssist.jsx`). When adding a new page: create `src/<Name>.jsx`, import it in `App.jsx`, add a `<Route>`, and add a `NAV` entry (respecting the Main / Workspace / Admin sectioning).

### Styling convention

There is **no CSS module / Tailwind / styled-components** — styling is two layers:

1. **CSS custom properties** defined in `src/index.css` under `:root` (light) and `.dark` (dark). Always reference colors via `var(--bg)`, `var(--bg2)`, `var(--bg3)`, `var(--bg4)`, `var(--border)`, `var(--border2)`, `var(--accent)`, `var(--text)`, `var(--text2)`, `var(--text3)`, `var(--green)`, `var(--amber)`, `var(--red)`, `var(--font)` — never hardcode hex values for theme-aware surfaces. Dark mode works automatically because the `.dark` class on the app root rebinds those variables.
2. **Inline `style={}` objects** in each page, typically collected into a module-level `s = { ... }` map (see `Dashboard.jsx`). Follow that pattern when editing or adding pages rather than introducing a new styling system.

Brand/status colors used as literals across pages: `#0066cc` (accent/blue), `#34c759` (green), `#ff9500` (amber), `#ff3b30` (red), `#534AB7` (purple). Team-member initials have a consistent color mapping used in multiple files — e.g. `teamColors = { JD: '#0066cc', MR: '#34c759', SW: '#534AB7', AL: '#ff9500' }` in `JobsProposals.jsx`. Keep these consistent when touching any page that shows team initials or status pills.

### Data

Every page currently declares its mock data (jobs, proposals, clients, tickets, devices, etc.) as top-level `const` arrays at the top of the file. There is no shared store, no API layer, and no persistence yet. When wiring real data, expect to replace those module-level constants per page.

### Domain vocabulary

"Composer builds", "Driver library", "Director", "EA-3/EA-5", "Lutron RadioRA3/Caseta", "Araknis", "Sonos", "Ecobee" are Control4-ecosystem terms — the app models an installer's workflow around jobs → proposals → build docs → programming → sign-off, plus ongoing support tickets and inventory. Dashboard stats, ticket urgency, and job phases all refer back to this workflow.
