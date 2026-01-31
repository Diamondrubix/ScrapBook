# AI_GUIDE.md

This doc is for AI agents joining the project later. It is intentionally concise and practical.

## Quick Start
1. `npm install`
2. Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Run `supabase/schema.sql` in Supabase SQL Editor
4. Create storage bucket `board-media` (public) and apply storage policies from `README.md`
5. Enable realtime replication for `items` and `item_locks`
6. `npm run dev`

## Architecture Map
- `src/pages/Board.tsx`: board view, uploads, tool state (color + active tool)
- `src/components/BoardCanvas.tsx`: canvas shell, pan/zoom, tool routing
- `src/canvas/CanvasItem.tsx`: renders items + selection handles
- `src/canvas/tools/`: object-oriented tools
  - `SelectTool.ts`: pan + move/resize/rotate + selection
  - `ShapeTool.ts`: drag-to-draw rect/circle/arrow
  - `PenTool.ts`: freehand pen tool
- `src/hooks/`: Supabase realtime hooks
  - `useRealtimeBoard.ts`: items CRUD + realtime
  - `usePresence.ts`: live cursors
  - `useItemLocks.ts`: selection locking

## Canvas Conventions
- World coordinates are stored in `items` (x, y, width, height, rotation).
- View transforms are applied in `BoardCanvas` (pan + zoom).
- New items are assigned `z_index = max + 1` in `useRealtimeBoard`.

## Item Data Shapes
- `shape`: `{ kind: 'rect'|'circle'|'arrow', color }`
- `draw`: `{ points: {x,y}[], color, strokeWidth }`
- `text`: `{ text }`
- `image`: `{ url }`
- `video_hosted`: `{ url }`
- `video_embed`: `{ url }`
- `link`: `{ url }`

## Supabase Notes
- RLS is enabled on core tables.
- Board creation uses RPC `create_board(title)` to avoid RLS recursion.
- Storage bucket `board-media` is public for MVP.
- Presence uses Supabase Realtime channels (`presence:{boardId}`).

## Adding a New Tool
1. Create a class in `src/canvas/tools/` extending `BaseTool`.
2. Implement pointer handlers and `renderOverlay()` as needed.
3. Register it in `BoardCanvas` tool map.
4. Add the tool to the toolbar UI.

## Common Pitfalls
- RLS errors usually mean no auth session or missing policies.
- Missing bucket or storage policies will break uploads.
- Magic link callbacks require correct Site URL and Redirect URLs.

## Next Likely Enhancements
- Undo/redo stack
- Daily snapshots
- Multi-canvas linking
- Link previews (server-side fetch)
