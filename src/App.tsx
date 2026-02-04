import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "./auth/AuthGate";
import type { Board } from "./lib/types";
import { BoardsPage } from "./pages/Boards";
import { BoardPage } from "./pages/Board";
import { PublicBoardPage } from "./pages/PublicBoard";

function getPublicSlugFromLocation(): { slug: string | null; canonicalUrl: string | null } {
  const base = import.meta.env.BASE_URL ?? "/";
  const stripBase = (path: string) => {
    if (base !== "/" && path.startsWith(base)) return path.slice(base.length);
    const baseNoTrailing = base.endsWith("/") ? base.slice(0, -1) : base;
    if (baseNoTrailing && baseNoTrailing !== "/" && path.startsWith(baseNoTrailing)) {
      return path.slice(baseNoTrailing.length);
    }
    return path;
  };

  const parse = (fullPath: string) => {
    const pathOnly = fullPath.split(/[?#]/)[0];
    const withinBase = stripBase(pathOnly);
    const segments = withinBase.split("/").filter(Boolean);
    if (segments[0] === "public" && segments[1]) return segments[1];
    return null;
  };

  const direct = parse(window.location.pathname);
  if (direct) return { slug: direct, canonicalUrl: null };

  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("p");
  if (!encoded) return { slug: null, canonicalUrl: null };

  let decoded = encoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    // If decoding fails, just treat it as a raw path.
  }

  const fromRedirect = parse(decoded);
  if (!fromRedirect) return { slug: null, canonicalUrl: null };
  return { slug: fromRedirect, canonicalUrl: `${base}public/${fromRedirect}` };
}

export default function App() {
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const initialRoute = useMemo(() => getPublicSlugFromLocation(), []);
  const [publicSlug, setPublicSlug] = useState<string | null>(initialRoute.slug);

  useEffect(() => {
    if (initialRoute.canonicalUrl) {
      window.history.replaceState({}, "", initialRoute.canonicalUrl);
    }
  }, [initialRoute.canonicalUrl]);

  if (publicSlug) {
    return (
      <PublicBoardPage
        slug={publicSlug}
        onBack={() => {
          setPublicSlug(null);
          window.history.pushState({}, "", import.meta.env.BASE_URL ?? "/");
        }}
      />
    );
  }

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
