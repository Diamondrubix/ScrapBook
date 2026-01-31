import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Use BASE_PATH for GitHub Pages project sites (e.g., "/repo-name/").
  base: process.env.BASE_PATH ?? "/",
});
