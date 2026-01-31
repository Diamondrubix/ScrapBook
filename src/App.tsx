import { useState } from "react";
import { AuthGate } from "./auth/AuthGate";
import type { Board } from "./lib/types";
import { BoardsPage } from "./pages/Boards";
import { BoardPage } from "./pages/Board";

export default function App() {
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);

  return (
    <AuthGate>
      {({ user }) =>
        activeBoard ? (
          <BoardPage board={activeBoard} user={user} onBack={() => setActiveBoard(null)} />
        ) : (
          <BoardsPage user={user} onOpenBoard={setActiveBoard} />
        )
      }
    </AuthGate>
  );
}
