# Architecture Guide

This document explains where execution starts, how to trace control flow, and how the pieces fit together for the Shared Scrapbook app.

## Execution Flow (Where It Starts)
1. `index.html` loads the React entrypoint at `src/main.tsx`.
2. `src/main.tsx` mounts React and renders `<App />`.
3. `src/App.tsx` decides which top-level view to render:
   - Public link (`/public/:slug`) -> `PublicBoardPage`.
   - Authenticated flow -> `AuthGate`, then `BoardsPage` or `BoardPage`.

## Top-Level Routing
- `src/App.tsx`: URL parsing, GitHub Pages redirect fallback, public links, and switching between views.
- `src/auth/AuthGate.tsx`: Magic-link auth and session bootstrap.
- `src/pages/Boards.tsx`: Board list and board creation.
- `src/pages/Board.tsx`: Main authenticated board UI.
- `src/pages/PublicBoard.tsx`: Read-only public view.

## Main User Journey (Happy Path)
1. App loads: `index.html` -> `src/main.tsx` -> `src/App.tsx`.
2. Auth flow: `AuthGate` checks session or prompts for magic-link login.
3. Board list: `BoardsPage` loads boards via `board_members`.
4. Board UI: `BoardPage` wires the canvas, realtime hooks, presence, and locks.

## Data + Realtime Flow
- Supabase client: `src/lib/supabase.ts`.
- Items + realtime:
  - `src/hooks/useRealtimeBoard.ts` loads items and subscribes to `items` changes.
  - Optimistic updates for create/update/delete; realtime reconciles.
- Presence:
  - `src/hooks/usePresence.ts` uses Supabase Presence channels for cursors.
- Locks:
  - `src/hooks/useItemLocks.ts` tracks `item_locks` to prevent collisions.

## Canvas Architecture
- Shell and event router: `src/components/BoardCanvas.tsx`
  - Owns view state (pan/zoom).
  - Dispatches pointer events to tools.
  - Builds a `ToolContext` for tools to read/write state.
- Item rendering: `src/canvas/CanvasItem.tsx`
  - Renders the different item types and selection handles.
- Tools:
  - `src/canvas/tools/BaseTool.ts` defines the tool contract.
  - `src/canvas/tools/SelectToolImpl.tsx` handles selection, pan, move, resize, rotate.
  - `src/canvas/tools/ShapeToolImpl.tsx` handles drag-to-draw shapes.
  - `src/canvas/tools/PenToolImpl.tsx` handles freehand drawing.

## How User Actions Write Data
- Create item:
  - Toolbar -> `BoardPage` handler -> `useRealtimeBoard.createItem` -> insert into `items`.
- Drag/resize/rotate:
  - `SelectTool` updates local state immediately and throttles remote updates.
- Draw/shape:
  - `ShapeTool`/`PenTool` create new items via `ToolContext`.

## Public Board View
- `PublicBoardPage` loads a board by `public_slug`.
- Uses `useRealtimeBoard` to receive live updates.
- `BoardCanvas` is rendered with `readOnly` enabled.

## Database Schema
Defined in `supabase/schema.sql`.
Core tables:
- `boards`
- `board_members`
- `items`
- `item_locks`

## Suggested Read Order
1. `README.md` (overview and setup)
2. `index.html` and `src/main.tsx` (entrypoint)
3. `src/App.tsx` (routing)
4. `src/auth/AuthGate.tsx` (auth)
5. `src/pages/Boards.tsx` and `src/pages/Board.tsx`
6. `src/hooks/useRealtimeBoard.ts` (data lifecycle)
7. `src/components/BoardCanvas.tsx` (canvas event model)
8. `src/canvas/tools/SelectToolImpl.tsx` (interactions)
9. `src/canvas/CanvasItem.tsx` (rendering)
