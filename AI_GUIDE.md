# AI_GUIDE.md

This doc is for AI agents joining the project. It is intentionally practical and action-oriented.

## Quick start
1. `npm install`
2. Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Run `supabase/schema.sql` in Supabase SQL Editor
4. Create storage bucket `board-media` (public) and apply storage policies from `README.md`
5. Enable realtime replication for `items` and `item_locks`
6. `npm run dev`

## Architecture map
- `src/App.tsx`: lightweight routing (public link + AuthGate) and GitHub Pages `?p=` shim
- `src/auth/AuthGate.tsx`: magic link sign-in and session bootstrapping
- `src/pages/Boards.tsx`: list boards, create board, sign out
- `src/pages/Board.tsx`: main editor view, uploads, public link toggle
- `src/pages/PublicBoard.tsx`: read-only board view for public links
- `src/components/BoardCanvas.tsx`: pan/zoom, pointer events, and tool dispatch
- `src/canvas/tools/`: tool classes with pointer handlers
- `src/canvas/CanvasItem.tsx`: renders items and selection handles
- `src/hooks/`: realtime data hooks (items, locks, presence)
- `supabase/schema.sql`: schema, RLS policies, RPCs

## Routing details
- Public boards live at `/public/:slug`.
- GitHub Pages does not support SPA routing; `public/404.html` redirects to `/?p=...`.
- `src/App.tsx` parses `?p=` and normalizes the URL back to `/public/:slug`.
 - Public links are viewer-only; edits require auth + board membership.

## Data + realtime flow
- `useRealtimeBoard` loads items for a board, then subscribes to Postgres changes.
- `updateItem` is optimistic (local state is updated before the DB write completes).
- Live cursors are presence-only (see `usePresence`).
- Item locks are stored in `item_locks` and used by the select tool to prevent conflicts.

## Canvas conventions
- Items are stored in world coordinates (x, y, width, height, rotation).
- View transforms (pan + zoom) happen in `BoardCanvas`.
- `BoardCanvas` passes a `ToolContext` into the active tool.

## Tool behaviors
- Select tool: move, resize, rotate, pan (right-drag), box-select (left-drag)
- Shape tools: drag-to-draw rect/circle/arrow, then auto-return to select
- Pen tool: freehand draw, stays active after each stroke

## Item data shapes
- `shape`: `{ kind: 'rect'|'circle'|'arrow', color }`
- `draw`: `{ points: {x,y}[], color, strokeWidth }`
- `text`: `{ text }`
- `image`: `{ url }`
- `video_hosted`: `{ url }`
- `video_embed`: `{ url }`
- `link`: `{ url }`

## Supabase notes
- RLS is enabled on core tables.
- Board creation uses RPC `create_board(title)` to avoid RLS recursion.
- Storage bucket `board-media` is public for the MVP.
- Presence uses Supabase Realtime channels (`presence:{boardId}`).

## Known workarounds
See `TODO_WORKAROUNDS.md`. This includes GH Pages routing shims, public bucket, lock TTL, and drag jitter notes.

## Adding a new tool
1. Create a class in `src/canvas/tools/` extending `BaseTool`.
2. Implement pointer handlers and `renderOverlay()` as needed.
3. Register it in `BoardCanvas` tool map.
4. Add the tool to the `Toolbar` UI.

## Common pitfalls
- RLS errors usually mean no auth session or missing policies.
- Missing bucket or storage policies will break uploads.
- Magic link callbacks require correct Site URL and Redirect URLs.
