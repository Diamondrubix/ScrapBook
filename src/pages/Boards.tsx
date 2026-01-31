import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Board } from "../lib/types";

type BoardsPageProps = {
  user: User;
  onOpenBoard: (board: Board) => void;
};

export function BoardsPage({ user, onOpenBoard }: BoardsPageProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadBoards = async () => {
    setError(null);
    const { data, error: loadError } = await supabase
      .from("board_members")
      .select("board:boards(*)")
      .eq("user_id", user.id);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    const mapped = (data ?? [])
      .map((row) => row.board as Board | null)
      .filter(Boolean) as Board[];
    setBoards(mapped);
  };

  useEffect(() => {
    void loadBoards();
  }, []);

  const createBoard = async () => {
    setError(null);
    if (!title.trim()) return;

    const { data: board, error: createError } = await supabase
      .rpc("create_board", { p_title: title.trim() })
      .single();

    if (createError || !board) {
      setError(createError?.message ?? "Failed to create board");
      return;
    }

    setTitle("");
    setBoards((prev) => [board as Board, ...prev]);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="page stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Shared Scrapbook</h1>
        <button className="button secondary" onClick={signOut}>
          Sign out
        </button>
      </div>

      <div className="card stack">
        <h3>Create a new board</h3>
        <div className="row">
          <input
            className="input"
            placeholder="Board title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button className="button" onClick={createBoard}>
            Create
          </button>
        </div>
      </div>

      <div className="board-list">
        {boards.map((board) => (
          <div key={board.id} className="card stack">
            <strong>{board.title}</strong>
            <button className="button" onClick={() => onOpenBoard(board)}>
              Open board
            </button>
          </div>
        ))}
      </div>

      {error && <p style={{ color: "#d11" }}>{error}</p>}
    </div>
  );
}
