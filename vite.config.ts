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
        const pathname = (parsed.pathname || "").replace(/\/$/, "");

        // Route mapping
        let modulePath: string | null = null;
        const queryParams: Record<string, string> = { ...(parsed.query as Record<string, string>) };

        if (pathname === "/api/config") {
          modulePath = path.resolve(__dirname, "./api/config.ts");
        } else if (pathname === "/api/services") {
          modulePath = path.resolve(__dirname, "./api/services.ts");
        } else if (pathname === "/api/settings") {
          modulePath = path.resolve(__dirname, "./api/settings.ts");
        } else if (pathname === "/api/service-cities") {
          modulePath = path.resolve(__dirname, "./api/service-cities.ts");
        } else if (pathname === "/api/booking-options") {
          modulePath = path.resolve(__dirname, "./api/booking-options.ts");
        } else if (pathname === "/api/dashboard") {
          modulePath = path.resolve(__dirname, "./api/dashboard.ts");
        } else if (pathname === "/api/bookings") {
          modulePath = path.resolve(__dirname, "./api/bookings/index.ts");
        } else if (pathname === "/api/plans") {
          modulePath = path.resolve(__dirname, "./api/plans/index.ts");
        } else if (pathname === "/api/contact") {
          modulePath = path.resolve(__dirname, "./api/contact.ts");
        } else if (pathname === "/api/loyalty") {
          modulePath = path.resolve(__dirname, "./api/loyalty.ts");
        } else if (pathname === "/api/notifications") {
          modulePath = path.resolve(__dirname, "./api/notifications.ts");
        } else {
          // Dynamic sub-routes
          // /api/bookings/:id
          const cancelMatch = pathname.match(/^\/api\/bookings\/([^\/]+)\/cancel$/);
          const rescheduleMatch = pathname.match(/^\/api\/bookings\/([^\/]+)\/reschedule$/);
          const checkoutMatch = pathname.match(/^\/api\/bookings\/([^\/]+)\/checkout$/);
          const invoiceMatch = pathname.match(/^\/api\/bookings\/([^\/]+)\/invoice$/);
          const photosMatch = pathname.match(/^\/api\/bookings\/([^\/]+)\/photos$/);
          const refundMatch = pathname.match(/^\/api\/bookings\/([^\/]+)\/refund$/);
          const singleBookingMatch = pathname.match(/^\/api\/bookings\/([^\/]+)$/);
          const singlePlanMatch = pathname.match(/^\/api\/plans\/([^\/]+)$/);

          if (cancelMatch) {
            queryParams.id = cancelMatch[1];
            modulePath = path.resolve(__dirname, "./api/bookings/[id]/cancel.ts");
          } else if (rescheduleMatch) {
            queryParams.id = rescheduleMatch[1];
            modulePath = path.resolve(__dirname, "./api/bookings/[id]/reschedule.ts");
          } else if (checkoutMatch) {
            queryParams.id = checkoutMatch[1];
            modulePath = path.resolve(__dirname, "./api/bookings/[id]/checkout.ts");
          } else if (invoiceMatch) {
            queryParams.id = invoiceMatch[1];
            modulePath = path.resolve(__dirname, "./api/bookings/[id]/invoice.ts");
          } else if (photosMatch) {
            queryParams.id = photosMatch[1];
            modulePath = path.resolve(__dirname, "./api/bookings/[id]/photos.ts");
          } else if (refundMatch) {
            queryParams.id = refundMatch[1];
            modulePath = path.resolve(__dirname, "./api/bookings/[id]/refund.ts");
          } else if (singleBookingMatch) {
            queryParams.id = singleBookingMatch[1];
            modulePath = path.resolve(__dirname, "./api/bookings/[id]/index.ts");
          } else if (singlePlanMatch) {
            queryParams.id = singlePlanMatch[1];
            modulePath = path.resolve(__dirname, "./api/plans/[id].ts");
          }
        }

        if (!modulePath) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: `API route not found: ${pathname}` }));
          return;
        }

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
