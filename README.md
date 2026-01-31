# Shared Scrapbook (MVP)

A realtime, infinite canvas scrapbook built with React + Supabase. Users can create boards, invite collaborators, and add mixed media, shapes, and freehand drawings.

## Prerequisites
- Node.js 18+
- A Supabase project

## Local Setup

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

## GitHub Pages deployment
This repo includes a GitHub Actions workflow that builds on every push to `master` and deploys to GitHub Pages.

### 1) Add secrets
Repo Settings → Secrets and variables → Actions → New repository secret:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 2) Enable Pages
Repo Settings → Pages:
- Source: **GitHub Actions**

### 3) Update Supabase Auth URLs for prod
When your site is live, set:
- **Site URL**: `https://<username>.github.io/<repo-name>/`
- **Redirect URLs**: `https://<username>.github.io/<repo-name>/**`

Notes:
- This is a static site deploy; there is no “server restart.”
- The workflow sets `BASE_PATH` to `/<repo-name>/` to match GitHub Pages project sites.

## Run the app
```
npm run dev
```

## Troubleshooting
- **RLS errors (403):** confirm you clicked the magic link and have a session in Local Storage.
- **Boards not showing:** re-run the RLS policies in `supabase/schema.sql`.
- **Uploads fail:** verify `board-media` exists and storage policies are applied.

## Project Layout (high level)
- `src/components/BoardCanvas.tsx`: canvas shell and event routing
- `src/canvas/tools/`: tool classes (select, shape, pen)
- `src/canvas/CanvasItem.tsx`: item rendering + selection handles
- `src/pages/Board.tsx`: board page, uploads, and tool state
- `supabase/schema.sql`: database schema + RLS policies + RPCs

## Security Note
Never expose the Supabase service role key in client code. The frontend uses only the anon/public key.
