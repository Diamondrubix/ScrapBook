# Temporary Workarounds / Non-Scalable Choices

This document lists intentional shortcuts or hacks currently in the codebase that should be revisited for a more robust, scalable implementation.

## 1) GitHub Pages SPA fallback (404 redirect)
- File: `public/404.html`
- What it does: Redirects any unknown path back to the project root with `?p=...` so the SPA can route.
- Why it's a workaround: It's a static-host-specific hack required because GitHub Pages doesn't support SPA routing.
- Proper fix (if desired): Use a host with native SPA routing (Vercel/Netlify/Cloudflare Pages) or add a server that always serves `index.html` for app routes.

## 2) Hard-coded magic-link redirect
- File: `src/auth/AuthGate.tsx`
- What it does: Forces `emailRedirectTo` to `${window.location.origin}/ScrapBook/`.
- Why it's a workaround: It's environment-specific and will break if the base path changes (custom domain, different repo name).
- Proper fix: Use an env var (e.g., `VITE_PUBLIC_URL`) and fall back to `import.meta.env.BASE_URL`.

## 3) Public route parsing relies on `?p=` shim
- File: `src/App.tsx`
- What it does: Reads `?p=` to recover the original path after the 404 redirect.
- Why it's a workaround: This only exists to support GitHub Pages SPA routing.
- Proper fix: Same as #1 (host with real SPA routing, or add a server that rewrites all routes to `index.html`).

