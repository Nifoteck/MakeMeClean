import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import url from "url";

function apiDevServerPlugin(): Plugin {
  return {
    name: "api-dev-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const reqUrl = req.url || "";
        if (!reqUrl.startsWith("/api/")) {
          return next();
        }

        const parsed = url.parse(reqUrl, true);
        const queryParams: Record<string, any> = { ...(parsed.query as Record<string, any>) };
        const modulePath = path.resolve(__dirname, "./api/index.ts");

        try {
          // Read request body if present
          let body: any = {};
          if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
            const buffers: Buffer[] = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const rawBody = Buffer.concat(buffers).toString();
            if (rawBody) {
              try {
                body = JSON.parse(rawBody);
              } catch (_) {
                body = rawBody;
              }
            }
          }

          // Polyfill VercelRequest and VercelResponse methods
          const vercelReq = Object.assign(req, {
            query: queryParams,
            body,
            cookies: {},
          });

          const vercelRes = Object.assign(res, {
            status(code: number) {
              res.statusCode = code;
              return vercelRes;
            },
            json(jsonBody: any) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(jsonBody));
              return vercelRes;
            },
            send(data: any) {
              res.end(data);
              return vercelRes;
            },
          });

          const mod = await server.ssrLoadModule(modulePath);
          const handler = mod.default || mod;
          if (typeof handler === "function") {
            await handler(vercelReq, vercelRes);
          } else {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: "Handler is not a function" }));
          }
        } catch (err: any) {
          console.error(`[API Dev Error] ${pathname}:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: err?.message || "Internal server error" }));
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevServerPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "./src/assets"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
});
