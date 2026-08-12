import { Router } from "express";
import { pool } from "../config/db.js";
import { runSync } from "../services/sync.js";

export const syncRouter = Router();

syncRouter.post("/run", async (req, res) => {
  try {
    const result = await runSync({ triggeredBy: "manual_button" });
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
