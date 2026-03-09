import express from "express";
import cors from "cors";
import filterRoutes from "./routes/filterRoutes";
import transactionRoutes from "./routes/transactionRoutes";

const app = express();
const PORT = process.env.PORT ?? 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Simple API key auth (optional — for securing app-to-server communication)
// Apple's filter request does NOT include custom headers, so /api/filter-sms
// is left open. Secure it via IP allowlisting or other network-level controls.
const API_KEY = process.env.API_KEY;

function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!API_KEY) return next(); // No key configured = skip auth
  const provided = req.headers["x-api-key"];
  if (provided !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Apple's ILMessageFilterExtension endpoint — NO auth (Apple can't send custom headers)
app.use("/api", filterRoutes);

// App API endpoints — optional auth
app.use("/api/transactions", authMiddleware, transactionRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  SpendTracker Backend                                ║
║  Running on port ${PORT}                               ║
║                                                      ║
║  Endpoints:                                          ║
║  POST /api/filter-sms      ← Apple SMS filter        ║
║  GET  /api/transactions    ← App: list transactions  ║
║  GET  /api/transactions/summary ← App: dashboard     ║
║  DEL  /api/transactions/:id     ← App: delete        ║
║  GET  /health              ← Health check             ║
╚══════════════════════════════════════════════════════╝
  `);
});

export default app;
