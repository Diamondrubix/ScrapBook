# Temporary Workarounds / Non-Scalable Choices

This document lists intentional shortcuts or hacks currently in the codebase that should be revisited for a more robust, scalable implementation.

## 1) GitHub Pages SPA fallback (404 redirect)
- File: `public/404.html`
- What it does: Redirects any unknown path back to the project root with `?p=...` so the SPA can route.
- Why it's a workaround: It's a static-host-specific hack required because GitHub Pages doesn't support SPA routing.
- Proper fix (if desired): Use a host with native SPA routing (Vercel/Netlify/Cloudflare Pages) or add a server that always serves `index.html` for app routes.

## 2) Hard-coded magic-link redirect
- File: `src/auth/AuthGate.tsx`
- What it does: Uses `window.location.origin + import.meta.env.BASE_URL` to build the redirect URL.
- Why it's a workaround: This assumes `BASE_URL` is accurate for every deployment and ties auth redirects to the current runtime origin.
- Proper fix: Use an explicit env var (e.g., `VITE_PUBLIC_URL`) per environment, and validate against Supabase Redirect URLs.

## 3) Public route parsing relies on `?p=` shim
- File: `src/App.tsx`
- What it does: Reads `?p=` to recover the original path after the 404 redirect.
- Why it's a workaround: This only exists to support GitHub Pages SPA routing.
- Proper fix: Same as #1 (host with real SPA routing, or add a server that rewrites all routes to `index.html`).

## 4) Item locks have no expiration/heartbeat
- File: `src/hooks/useItemLocks.ts`, table `item_locks`
- What it does: Locks persist until the client releases them.
- Why it's a workaround: If a client disconnects, locks can linger and block edits.
- Proper fix: Add `expires_at`, a heartbeat, and ignore or clear expired locks (cron, edge function, or DB policy).

## 5) Storage bucket is public
- File: `supabase/schema.sql` + storage policy notes in `README.md`
- What it does: Uploaded media is accessible via public URLs.
- Why it's a workaround: Convenient for MVP but not appropriate for private boards.
- Proper fix: Use private buckets + signed URLs, and gate access by board membership.

## 6) Lock subscription is not filtered by board
- File: `src/hooks/useItemLocks.ts`
- What it does: Realtime subscription listens to all `item_locks` changes and applies them locally.
- Why it's a workaround: For large installs this can pull unrelated locks and waste bandwidth.
- Proper fix: Filter the realtime subscription by board_id (e.g., via a view or a Postgres filter).

## 7) Client-side z_index assignment
- File: `src/hooks/useRealtimeBoard.ts`
- What it does: `z_index` is computed on the client as max + 1.
- Why it's a workaround: Concurrent inserts can collide or reorder unexpectedly.
- Proper fix: Move z_index assignment to the server (DB function or trigger) or sort by created_at with stable tie-breaker.

## 8) Drag jitter during moves (known issue)
- Files: `src/hooks/useRealtimeBoard.ts`, `src/components/BoardCanvas.tsx`, `src/canvas/tools/SelectToolImpl.tsx`
- What it does: Dragging updates the DB frequently, then realtime updates race with optimistic UI updates.
- Why it's a workaround: It can cause visual jitter or tiny teleports while dragging.
- Proposed fix: Decouple drag rendering from DB writes (local transform preview), only commit on pointer-up, and optionally broadcast ephemeral drag transforms over presence channels for collaborators.

## 9) URL inputs use `prompt()`
- File: `src/components/Toolbar.tsx`
- What it does: Browser prompts are used to collect URLs for links and embeds.
- Why it's a workaround: Prompts are blocking, not stylable, and easy to cancel accidentally.
- Proper fix: Replace with a custom modal or inline form field.

## 10) Public link toggle has minimal error feedback
- File: `src/pages/Board.tsx`
- What it does: If enabling/disabling public links fails, the UI does not surface the error.
- Why it's a workaround: Users are left with no feedback on failure.
- Proper fix: Display an error toast/banner and revert the local toggle state.
