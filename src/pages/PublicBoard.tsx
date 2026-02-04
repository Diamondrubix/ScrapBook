import { useEffect, useState } from "react";
import type { Board } from "../lib/types";
import { supabase } from "../lib/supabase";
import { useRealtimeBoard } from "../hooks/useRealtimeBoard";
import { BoardCanvas } from "../components/BoardCanvas";

type PublicBoardPageProps = {
  slug: string;
  onBack: () => void;
};

export function PublicBoardPage({ slug, onBack }: PublicBoardPageProps) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data, error: loadError } = await supabase
        .from("boards")
        .select("*")
        .eq("public_slug", slug)
        .eq("is_public", true)
        .single();

      if (!mounted) return;
      if (loadError) {
        setError(loadError.message);
        return;
      }
      setBoard(data as Board);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const boardId = board?.id ?? "";
  // Public view is read-only but still subscribes to realtime updates.
  const { items } = useRealtimeBoard(boardId, "public-viewer");

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <p>{error}</p>
          <button className="button secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="page">
        <div className="card">Loading public board...</div>
      </div>
    );
  }

  return (
    <div className="page stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <button className="button secondary" onClick={onBack}>
            Back
          </button>
          <h2>{board.title}</h2>
        </div>
        <span>Viewer mode</span>
      </div>

      <BoardCanvas
        items={items}
        presence={[]}
        selectedIds={[]}
        onSelectIds={() => {}}
        onUpdateItem={() => {}}
        onDeleteItem={() => {}}
        isLockedByOther={() => false}
        onCursorMove={() => {}}
        tool="select"
        drawColor="#111111"
        onToolChange={() => {}}
        onCreateShape={() => {}}
        onCreateDraw={() => {}}
        readOnly
      />
    </div>
  );
}
