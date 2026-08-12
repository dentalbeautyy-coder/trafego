import { Router } from "express";
import { pool } from "../config/db.js";
import { runSync } from "../services/sync.js";
import { fetchAllInsightsDaily } from "../services/metaClient.js";

export const syncRouter = Router();

// Diagnóstico temporário — ver os action_type reais que a Meta devolve, pra achar
// o nome certo de "conversas iniciadas". Remover depois.
syncRouter.get("/debug-actions", async (req, res) => {
  try {
    const insights = await fetchAllInsightsDaily(process.env.META_AD_ACCOUNT_ID, 3);
    const withActions = insights.find((i) => Array.isArray(i.actions) && i.actions.length > 0);
    res.json({ sample: withActions || null, totalInsights: insights.length });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

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
