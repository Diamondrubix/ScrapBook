import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Board } from "../lib/types";
import { supabase } from "../lib/supabase";
import { useRealtimeBoard } from "../hooks/useRealtimeBoard";
import { usePresence } from "../hooks/usePresence";
import { useItemLocks } from "../hooks/useItemLocks";
import { BoardCanvas } from "../components/BoardCanvas";
import { Toolbar } from "../components/Toolbar";
import type { Point, ShapeKind, ToolId } from "../canvas/types";

type BoardPageProps = {
  board: Board;
  user: User;
  onBack: () => void;
};

function makeSlug() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export function BoardPage({ board, user, onBack }: BoardPageProps) {
  const [boardState, setBoardState] = useState(board);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<ToolId>("select");
  const [color, setColor] = useState("#111111");
  const [uiError, setUiError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const { items, createItem, updateItem, deleteItem, error } = useRealtimeBoard(
    board.id,
    user.id,
  );
  const { others, updateCursor } = usePresence(board.id, user);
  const { lockItem, unlockItem, isLockedByOther } = useItemLocks(board.id, user.id);

  const basePosition = () => {
    const offset = items.length * 20;
    return { x: 50 + offset, y: 50 + offset };
  };

  const handleSelectIds = async (nextIds: string[]) => {
    const prev = new Set(selectedIds);
    const next = new Set(nextIds);

    const toUnlock = selectedIds.filter((id) => !next.has(id));
    const toLock = nextIds.filter((id) => !prev.has(id));

    for (const id of toUnlock) {
      await unlockItem(id);
    }
    for (const id of toLock) {
      await lockItem(id);
    }

    setSelectedIds(nextIds);
  };

  const handleAddText = async () => {
    const pos = basePosition();
    await createItem({
      type: "text",
      data: { text: "New note" },
      x: pos.x,
      y: pos.y,
      width: 220,
      height: 120,
    });
  };

  const handleAddLink = async (url: string) => {
    const pos = basePosition();
    await createItem({
      type: "link",
      data: { url },
      x: pos.x,
      y: pos.y,
      width: 260,
      height: 120,
    });
  };

  const uploadFile = async (file: File) => {
    setUiError(null);
    const filePath = `boards/${board.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("board-media").upload(filePath, file, {
      upsert: true,
    });
    if (uploadError) {
      setUiError(uploadError.message);
      throw new Error(uploadError.message);
    }
    const { data } = supabase.storage.from("board-media").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAddImage = async (file: File) => {
    try {
      const pos = basePosition();
      const url = await uploadFile(file);
      await createItem({
        type: "image",
        data: { url },
        x: pos.x,
        y: pos.y,
        width: 320,
        height: 220,
      });
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Image upload failed");
    }
  };

  const handleAddVideoEmbed = async (url: string) => {
    const pos = basePosition();
    await createItem({
      type: "video_embed",
      data: { url },
      x: pos.x,
      y: pos.y,
      width: 360,
      height: 240,
    });
  };

  const handleAddVideoUpload = async (file: File) => {
    try {
      const pos = basePosition();
      const url = await uploadFile(file);
      await createItem({
        type: "video_hosted",
        data: { url },
        x: pos.x,
        y: pos.y,
        width: 360,
        height: 240,
      });
    } catch (err) {
      setUiError(err instanceof Error ? err.message : "Video upload failed");
    }
  };

  const handleCreateShape = async (args: {
    kind: ShapeKind;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  }) => {
    await createItem({
      type: "shape",
      data: { kind: args.kind, color },
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      rotation: args.rotation ?? 0,
    });
  };

  const handleCreateDraw = async (args: {
    points: Point[];
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    await createItem({
      type: "draw",
      data: { points: args.points, color, strokeWidth: 2 },
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      rotation: 0,
    });
  };

  const togglePublic = async () => {
    const next = !boardState.is_public;
    const slug = boardState.public_slug ?? makeSlug();
    const { data, error: updateError } = await supabase
      .from("boards")
      .update({ is_public: next, public_slug: slug })
      .eq("id", boardState.id)
      .select()
      .single();

    if (updateError) return;
    setBoardState(data as Board);
  };

  const publicUrl =
    boardState.is_public && boardState.public_slug
      ? `${window.location.origin}${import.meta.env.BASE_URL}public/${boardState.public_slug}`
      : null;

  const copyPublicUrl = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(null), 1500);
    } catch {
      setCopyStatus("Copy failed");
      setTimeout(() => setCopyStatus(null), 1500);
    }
  };

  return (
    <div className="page stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <button className="button secondary" onClick={onBack}>
            Back
          </button>
          <h2>{boardState.title}</h2>
        </div>
        <div className="row">
          <button className="button secondary" onClick={togglePublic}>
            {boardState.is_public ? "Disable public link" : "Enable public link"}
          </button>
        </div>
      </div>

      {publicUrl && (
        <div className="card public-link">
          <div className="public-link__text">
            Public link (viewer-only for now):{" "}
            <a href={publicUrl} target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
          </div>
          <div className="row">
            <button className="button secondary" onClick={copyPublicUrl}>
              Copy URL
            </button>
            {copyStatus && <span>{copyStatus}</span>}
          </div>
        </div>
      )}

      <Toolbar
        onAddText={handleAddText}
        onAddLink={handleAddLink}
        onAddImage={handleAddImage}
        onAddVideoEmbed={handleAddVideoEmbed}
        onAddVideoUpload={handleAddVideoUpload}
        activeTool={tool}
        onSelectTool={setTool}
        color={color}
        onColorChange={setColor}
      />

      <BoardCanvas
        items={items}
        presence={others}
        selectedIds={selectedIds}
        onSelectIds={handleSelectIds}
        onUpdateItem={updateItem}
        onDeleteItem={deleteItem}
        isLockedByOther={isLockedByOther}
        onCursorMove={updateCursor}
        tool={tool}
        drawColor={color}
        onToolChange={setTool}
        onCreateShape={handleCreateShape}
        onCreateDraw={handleCreateDraw}
      />

      <div className="card">
        <strong>Tips:</strong> Drag to move. Use corner handles to resize. Alt-drag to rotate (single item).
        Left-drag on empty canvas to box-select. Right-drag to pan. Delete/Backspace removes selection.
        Shapes: select Rect/Circle/Arrow then drag on empty canvas to draw. Pen: click-drag to draw.
      </div>

      {(uiError || error) && <p style={{ color: "#d11" }}>{uiError ?? error}</p>}
    </div>
  );
}
