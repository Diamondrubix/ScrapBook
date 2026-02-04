import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthGateProps = {
  children: (args: { user: User }) => ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      // Handle PKCE magic-link callbacks (Supabase adds ?code= to the URL).
      if (window.location.search.includes("code=")) {
        await supabase.auth.exchangeCodeForSession(window.location.href);
      }
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(data.session?.user ?? null);
    };
    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const sendMagicLink = async () => {
    setError(null);
    setSent(false);
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Use BASE_URL so GitHub Pages project paths still work.
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      },
    });
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  };

  if (!user) {
    return (
      <div className="page">
        <div className="card stack" style={{ maxWidth: 420 }}>
          <h2>Sign in</h2>
          <p>Magic link login for the Shared Scrapbook.</p>
          <input
            className="input"
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="button" onClick={sendMagicLink} disabled={!email}>
            Send magic link
          </button>
          {sent && <p>Check your email for the link.</p>}
          {error && <p style={{ color: "#d11" }}>{error}</p>}
        </div>
      </div>
    );
  }

  return <>{children({ user })}</>;
}
