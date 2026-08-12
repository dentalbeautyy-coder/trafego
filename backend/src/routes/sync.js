import { Router } from "express";
import { pool } from "../config/db.js";
import { runSync } from "../services/sync.js";

export const syncRouter = Router();

// daysBack opcional via query string (?daysBack=30) — útil para um backfill pontual
// além dos 7 dias padrão do dia a dia.
syncRouter.post("/run", async (req, res) => {
  try {
    const daysBack = req.query.daysBack ? Number(req.query.daysBack) : undefined;
    const result = await runSync({ triggeredBy: "manual_button", ...(daysBack ? { daysBack } : {}) });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: "Falha na sincronização com a Meta", detail: err.message || String(err) });
  }
});

syncRouter.get("/logs", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM sync_logs ORDER BY started_at DESC LIMIT 50`
  );
  res.json(rows);
});
