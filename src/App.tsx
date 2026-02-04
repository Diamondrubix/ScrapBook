import { useEffect, useState } from "react";
import { AuthGate } from "./auth/AuthGate";
import type { Board } from "./lib/types";
import { BoardsPage } from "./pages/Boards";
import { BoardPage } from "./pages/Board";
import { PublicBoardPage } from "./pages/PublicBoard";

export default function App() {
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL ?? "/";
    const path = window.location.pathname.startsWith(base)
      ? window.location.pathname.slice(base.length)
      : window.location.pathname;
    const segments = path.split("/").filter(Boolean);
    if (segments[0] === "public" && segments[1]) {
      setPublicSlug(segments[1]);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const redirectPath = params.get("p");
    if (redirectPath) {
      const clean = redirectPath.replace(base, "");
      const redirectSegments = clean.split("/").filter(Boolean);
      if (redirectSegments[0] === "public" && redirectSegments[1]) {
        window.history.replaceState({}, "", base + redirectSegments.join("/"));
        setPublicSlug(redirectSegments[1]);
      }
    }
  }, []);

  return (
    <AuthGate>
      {({ user }) =>
        publicSlug ? (
          <PublicBoardPage slug={publicSlug} onBack={() => setPublicSlug(null)} />
        ) : activeBoard ? (
          <BoardPage board={activeBoard} user={user} onBack={() => setActiveBoard(null)} />
        ) : (
          <BoardsPage user={user} onOpenBoard={setActiveBoard} />
        )
      }
    </AuthGate>
  );
}
