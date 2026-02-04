# Shared Scrapbook (MVP)

A realtime, infinite canvas scrapbook built with React + Supabase. Users create boards, invite collaborators, and add mixed media, shapes, and freehand drawings.

## Prerequisites
- Node.js 18+
- A Supabase project

## Local setup

### 1) Install dependencies
```
npm install
```

### 2) Configure environment
Create `.env.local` in the repo root:
```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3) Supabase database setup
1. In Supabase Dashboard, open **SQL Editor**.
2. Run the SQL in `supabase/schema.sql`.

### 4) Storage setup (images + hosted video)
1. Create a bucket named `board-media` (public).
2. Add these storage policies in SQL Editor:
```
create policy "board_media_read" on storage.objects
  for select
  using (bucket_id = 'board-media');

create policy "board_media_write" on storage.objects
  for insert
  with check (bucket_id = 'board-media' and auth.role() = 'authenticated');
```

### 5) Realtime
Enable replication for these tables:
- `items`
- `item_locks`

### 6) Auth (magic link)
- Enable **Email** provider.
- **Site URL**: `http://localhost:5173`
- **Redirect URLs**: `http://localhost:5173/**`

If you deploy to GitHub Pages, add both local + prod redirect URLs so you do not have to keep switching.

## Routing and public links
- Public boards live at `/public/:slug`.
- Public links are viewer-only; edits require auth + board membership.
- GitHub Pages does not support SPA routing, so we use `public/404.html` to redirect to `/?p=...`.
- `src/App.tsx` parses `?p=` to recover the original route.

## GitHub Pages deployment
This repo includes a GitHub Actions workflow that builds on every push to `master` and deploys to GitHub Pages.

### 1) Add secrets
Repo Settings -> Secrets and variables -> Actions -> New repository secret:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 2) Enable Pages
Repo Settings -> Pages:
- Source: **GitHub Actions**

### 3) Update Supabase Auth URLs for prod
When your site is live, set:
- **Site URL**: `https://<username>.github.io/<repo-name>/`
- **Redirect URLs**: `https://<username>.github.io/<repo-name>/**`

Notes:
- This is a static site deploy; there is no server restart.
- The workflow sets `BASE_PATH` to `/<repo-name>/` to match GitHub Pages project sites.

## Run the app
```
npm run dev
```

## Troubleshooting
- **RLS errors (403):** confirm you clicked the magic link and have a session in Local Storage.
- **Boards not showing:** re-run the RLS policies in `supabase/schema.sql`.
- **Uploads fail:** verify `board-media` exists and storage policies are applied.
- **Public link 404 on GitHub Pages:** confirm `public/404.html` exists and `BASE_PATH` matches repo name.

## Project layout (high level)
- `src/App.tsx`: route handling (public links + AuthGate)
- `src/auth/AuthGate.tsx`: magic link sign-in flow
- `src/pages/Boards.tsx`: board list + create board
- `src/pages/Board.tsx`: board UI, uploads, public link toggle
- `src/pages/PublicBoard.tsx`: read-only public view
- `src/components/BoardCanvas.tsx`: canvas shell and event routing
- `src/canvas/tools/`: tool classes (select, shape, pen)
- `src/canvas/CanvasItem.tsx`: item rendering + selection handles
- `src/hooks/`: Supabase realtime hooks
- `supabase/schema.sql`: database schema + RLS policies + RPCs

## Architecture notes
- **Routing:** `App.tsx` decides between AuthGate and public view; GitHub Pages uses a 404 redirect shim (`public/404.html`) with `?p=` parsing.
- **Data flow:** `useRealtimeBoard` loads items, applies optimistic updates, and subscribes to Postgres changes via Realtime.
- **Canvas:** `BoardCanvas` owns pan/zoom state and delegates pointer events to tool classes via `ToolContext`.
- **Tools:** Tool classes compute world-space interactions; they call `createItem` and `updateItemThrottled` for writes.
- **Collaboration:** `usePresence` publishes cursors; `useItemLocks` prevents two editors from moving the same item.

## Security note
Never expose the Supabase service role key in client code. The frontend uses only the anon/public key.
