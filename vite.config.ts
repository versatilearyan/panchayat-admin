import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

type ProxyRes = {
  headersSent?: boolean;
  writeHead?: (code: number, headers: Record<string, string>) => void;
  end: (body: string) => void;
};

/**
 * While developing, the panel calls its own /api/… and Vite forwards those calls to
 * VITE_API_BASE_URL (your Spring Boot server or ngrok tunnel). The browser then never
 * talks to another origin, so the backend doesn't need CORS set up for localhost, and
 * ngrok's browser warning page never replaces an API reply or an uploaded image.
 */
function backendProxy(target: string): Record<string, ProxyOptions> {
  const route = (): ProxyOptions => ({
    target,
    changeOrigin: true,
    secure: true,
    headers: { "ngrok-skip-browser-warning": "true" },
    configure: (proxy) => {
      // Backend or tunnel down: answer with JSON the panel can explain, not an empty 500
      (
        proxy as unknown as {
          on: (
            ev: "error",
            cb: (
              err: Error & { code?: string },
              req: unknown,
              res: ProxyRes,
            ) => void,
          ) => void;
        }
      ).on("error", (err, _req, res) => {
        if (!res || typeof res.writeHead !== "function" || res.headersSent)
          return;
        res.writeHead(502, {
          "Content-Type": "application/json",
          "x-panel-proxy-error": "1",
        });
        res.end(
          JSON.stringify({
            message: `Couldn't connect to ${target} (${err.code ?? err.message}).`,
          }),
        );
      });
    },
  });
  // /uploads: images the backend serves from its uploads folder
  return { "/api": route(), "/uploads": route() };
}

// Runs on port 3100 so it can sit next to the Panchayat app (port 3000)
export default defineConfig(({ mode }) => {
  const target = (loadEnv(mode, ".", "VITE_").VITE_API_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  const proxy = target ? backendProxy(target) : undefined;
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 3100, proxy },
    preview: { port: 3100, proxy },
  };
});
