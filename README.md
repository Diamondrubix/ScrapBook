# Shared Scrapbook (MVP)

React + Supabase realtime canvas app. This repo scaffolds the frontend and includes a SQL schema for the backend.

## 1) Prereqs
- Node.js 18+
- Supabase project

## 2) Env
Create a `.env.local` file (not committed) based on `.env.example`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 3) Supabase setup
1. In the Supabase dashboard, open the SQL editor.
2. Run the contents of `supabase/schema.sql`.
3. Storage: create a bucket named `board-media`.
4. Realtime: enable replication for `items` and `item_locks`.
5. Auth: enable Email provider (magic link) and set Site URL / Redirect URLs.

## 4) Run
```
npm install
npm run dev
```

## Notes
- The prototype uses public URLs for uploaded media by default. Tighten storage policies later.
- The SQL file includes RLS policies for the main tables. Review and adjust as needed.
