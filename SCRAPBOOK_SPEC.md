# Shared Scrapbook – Product + Technical Specification

Date: 2026-01-30  
Author: User + Codex  
Status: Draft v1

## 1) Product Summary
Build a real-time, free-form, infinite canvas "shared scrapbook" web app where users can create boards, invite collaborators by email, and add mixed media: images, videos (hosted or embedded), text, links (auto-embed), and simple drawings/shapes. Boards are collaborative whiteboards with live cursors and item selection locking. Primary access is invite-by-email; public links are optional and can be toggled on/off. React for web, Supabase for backend. Mobile (React Native) planned later.

## 2) Core Requirements
### 2.1 Collaboration
- Real-time multi-user editing on a shared infinite canvas.
- Item-level lock: if a user selects an item, it is locked for others until released.
- Live cursors and presence indicators for all connected users.
- Access modes per board: view or edit.
- Public link: can be enabled/disabled by board owner; no other moderation initially.

### 2.2 Canvas
- Infinite canvas with free pan and zoom (no grid, no snap).
- One primary board per scrapbook.
- Future feature: link multiple canvases together (pages). Not in MVP.

### 2.3 Content Types
- Image: upload and place on canvas.
- Video: 
  - Hosted upload (stored in Supabase Storage).
  - Embedded video via URL (YouTube, Vimeo, etc.).
- Text: rich-ish text block (simple formatting optional in MVP).
- Link embed: if a URL is pasted, auto-create a preview tile with title/thumbnail.
- Shapes: arrows, circles, rectangles.
- Freehand drawing: basic pen/eraser (can be MVP+ if needed).

### 2.4 Undo + Recovery
- Per-user undo/redo for user’s own actions.
- Daily board snapshot/backup with ability to restore a prior day.

### 2.5 Performance / Limits
- No strict item limit for prototype; degradation acceptable.
- Avoid premature optimization.

## 3) MVP Scope (Must-Haves)
1. Board creation
2. Invite collaborators by email (view/edit)
3. Infinite canvas (pan/zoom)
4. Items: image, text, link embed, basic shape
5. Move/resize/rotate items
6. Realtime presence + live cursors
7. Item selection lock
8. Save/load board state

## 4) Non-Goals (for MVP)
- Multi-canvas linking/pages
- Full version history or granular audit trails
- Advanced permissions (teams/orgs)
- Mobile app (viewer or editor)
- Heavy performance optimizations

## 5) Data Model (Supabase / Postgres)
Use Supabase Auth for users, Storage for uploads, Realtime for collaboration.

### 5.1 Tables

#### users
- Managed by Supabase Auth.
- Use `auth.users` and a public profile table for display names/avatars.

#### profiles
```
id (uuid, pk, fk -> auth.users.id)
display_name (text)
avatar_url (text, nullable)
created_at (timestamptz)
```

#### boards
```
id (uuid, pk)
owner_id (uuid, fk -> auth.users.id)
title (text)
created_at (timestamptz)
updated_at (timestamptz)
is_public (boolean, default false)
public_slug (text, unique, nullable)  -- used for share links
```

#### board_members
```
board_id (uuid, fk -> boards.id)
user_id (uuid, fk -> auth.users.id)
role (text, enum: 'viewer' | 'editor')
invited_by (uuid, fk -> auth.users.id)
created_at (timestamptz)
primary key (board_id, user_id)
```

#### items
Stores canvas items in normalized rows.
```
id (uuid, pk)
board_id (uuid, fk -> boards.id)
type (text, enum: 'image'|'video_hosted'|'video_embed'|'text'|'link'|'shape'|'draw')
data (jsonb)  -- type-specific payload
x (float)     -- world coords
y (float)
width (float)
height (float)
rotation (float)  -- degrees
z_index (int)
created_by (uuid, fk -> auth.users.id)
created_at (timestamptz)
updated_at (timestamptz)
```

#### item_locks
```
item_id (uuid, pk, fk -> items.id)
user_id (uuid, fk -> auth.users.id)
locked_at (timestamptz)
expires_at (timestamptz)
```
Notes: locks should expire automatically after N seconds of inactivity (e.g. 20s).

#### item_ops (for per-user undo)
Stores user operations as events. This powers per-user undo/redo.
```
id (uuid, pk)
board_id (uuid, fk -> boards.id)
user_id (uuid, fk -> auth.users.id)
op_type (text, enum: 'create'|'update'|'delete'|'move'|'resize'|'rotate')
item_id (uuid, fk -> items.id)
before (jsonb)
after (jsonb)
created_at (timestamptz)
```

#### board_snapshots
Daily snapshots for rollback.
```
id (uuid, pk)
board_id (uuid, fk -> boards.id)
snapshot_date (date)
data (jsonb)  -- full board export (items + metadata)
created_at (timestamptz)
```

### 5.2 Storage
- Bucket: `board-media`
- Path: `boards/{board_id}/{item_id}/{filename}`
- Store images and hosted video files.

### 5.3 RLS Policies (High Level)
- Boards: owner + members can read/write; public boards read-only by link (if enabled).
- Items: access via board membership.
- Item locks: only editors can write; read for members.
- Ops: only creator can write; board editors can read.
- Snapshots: only owner can create; owner + editors can read.

## 6) Realtime Sync Strategy
### 6.1 Model
Use a server-authoritative model with optimistic UI:
- Client sends operations to server (via Supabase realtime channels or RPC).
- Server writes to `items` and broadcasts change events.
- Clients apply updates and reconcile with local state.

This avoids the complexity of CRDTs for MVP, but still provides real-time edits.

### 6.2 Events
Channel: `board:{board_id}`
Events broadcasted:
- `item.create`
- `item.update`
- `item.delete`
- `item.lock`
- `item.unlock`
- `presence.join`
- `presence.leave`
- `cursor.move`

### 6.3 Locking
- On selection, client requests lock for item.
- If lock exists, server rejects or indicates locked by another user.
- Lock auto-expires after inactivity (heartbeat).
- On deselect, client releases lock.

### 6.4 Cursors + Presence
- Use Supabase Realtime presence:
  - Track user_id, display_name, color, cursor position.
  - Broadcast ~10–20 times/second max (throttled).

### 6.5 Undo/Redo
- Every user action writes an `item_ops` entry.
- Undo reads last op for that user, applies inverse to `items`.
- Redo re-applies stored op.
- Only affects that user’s actions.

### 6.6 Daily Snapshots
- Scheduled job (Supabase Edge Function or external cron).
- For each board, serialize all items + board metadata into `board_snapshots`.
- Allow restore: replace current `items` with snapshot data (with confirmation).

## 7) Frontend Architecture
### 7.1 Stack
- React + TypeScript
- Canvas rendering: Konva / PixiJS / custom canvas (pick one).
- State: Zustand or Redux for local state.
- Realtime: Supabase JS realtime + presence.

### 7.2 Core UI Components
- Canvas viewport + zoom/pan
- Toolbar: add text, image, video, shape, draw
- Layers/selection panel (optional for MVP)
- Collaborators list with presence
- Share modal (invite by email + public link toggle)

## 8) Roadmap
### Phase 0: Setup (1–2 weeks)
- Project scaffold, Supabase setup
- Auth (email/password or magic link)
- Basic React canvas with pan/zoom

### Phase 1: MVP Collaboration (2–4 weeks)
- Boards + membership
- Items CRUD + rendering
- Realtime item sync
- Live cursors + presence
- Item locking
- Basic shapes + text + image upload

### Phase 2: Media + Embeds (2–3 weeks)
- Video upload + playback
- Link embed (URL parser + preview fetch)
- Draw tool

### Phase 3: Reliability (2–3 weeks)
- Per-user undo/redo
- Daily snapshots + restore
- Basic performance tuning

### Phase 4: Multi-Canvas (future)
- Link boards/pages
- Navigation between canvases
- Templates, export

## 9) Open Questions (if needed later)
- Which auth method (email/password vs magic link)?
- Do you need comments or annotations?
- Should public links be read-only or optionally editable?
- Should embedded video play inline or open modal?

