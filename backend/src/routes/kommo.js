import { Router } from "express";
import { pool } from "../config/db.js";
import { runKommoSync } from "../services/kommoSync.js";

export const kommoRouter = Router();

kommoRouter.post("/sync", async (req, res) => {
  try {
    const daysBack = req.query.daysBack ? Number(req.query.daysBack) : undefined;
    const result = await runKommoSync(daysBack ? { daysBack } : {});
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: "Falha na sincronização com a Kommo", detail: err.message });
  }
});

// Visão geral: total de leads no período, quebrado por responsável e por status.
kommoRouter.get("/overview", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "parâmetros from e to (YYYY-MM-DD) são obrigatórios" });

  const { rows: byResponsible } = await pool.query(
    `SELECT
       COALESCE(l.responsible_label, u.name, 'Sem responsável') AS responsible,
       COUNT(*) AS lead_count
     FROM kommo_leads l
     LEFT JOIN kommo_users u ON u.id = l.responsible_user_id
     WHERE l.kommo_created_at::date BETWEEN $1 AND $2
     GROUP BY 1
     ORDER BY lead_count DESC`,
    [from, to]
  );

  const { rows: byStatus } = await pool.query(
    `SELECT
       COALESCE(s.name, 'Sem status') AS status,
       COALESCE(p.name, '—') AS pipeline,
       COUNT(*) AS lead_count
     FROM kommo_leads l
     LEFT JOIN kommo_statuses s ON s.id = l.status_id
     LEFT JOIN kommo_pipelines p ON p.id = l.pipeline_id
     WHERE l.kommo_created_at::date BETWEEN $1 AND $2
     GROUP BY 1, 2
     ORDER BY lead_count DESC`,
    [from, to]
  );

  const { rows: totalRows } = await pool.query(
    `SELECT COUNT(*) AS total FROM kommo_leads WHERE kommo_created_at::date BETWEEN $1 AND $2`,
    [from, to]
  );

  res.json({
    total: Number(totalRows[0].total),
    byResponsible: byResponsible.map((r) => ({ responsible: r.responsible, count: Number(r.lead_count) })),
    byStatus: byStatus.map((r) => ({ status: r.status, pipeline: r.pipeline, count: Number(r.lead_count) })),
  });
});

// Por campanha: quantidade de leads, e dentro de cada campanha a quebra por
// responsável e por status — para responder "quem atendeu o que veio de cada anúncio".
kommoRouter.get("/campaigns", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "parâmetros from e to (YYYY-MM-DD) são obrigatórios" });

  const { rows: leads } = await pool.query(
    `SELECT
       COALESCE(l.campaign_label, 'Sem campanha identificada') AS campaign_label,
       COALESCE(l.responsible_label, u.name, 'Sem responsável') AS responsible,
       COALESCE(s.name, 'Sem status') AS status,
       l.id
     FROM kommo_leads l
     LEFT JOIN kommo_users u ON u.id = l.responsible_user_id
     LEFT JOIN kommo_statuses s ON s.id = l.status_id
     WHERE l.kommo_created_at::date BETWEEN $1 AND $2`,
    [from, to]
  );

  const campaigns = new Map();
  for (const row of leads) {
    if (!campaigns.has(row.campaign_label)) {
      campaigns.set(row.campaign_label, { campaign: row.campaign_label, total: 0, byResponsible: new Map(), byStatus: new Map() });
    }
    const c = campaigns.get(row.campaign_label);
    c.total++;
    c.byResponsible.set(row.responsible, (c.byResponsible.get(row.responsible) || 0) + 1);
    c.byStatus.set(row.status, (c.byStatus.get(row.status) || 0) + 1);
  }

  const result = Array.from(campaigns.values())
    .map((c) => ({
      campaign: c.campaign,
      total: c.total,
      byResponsible: Array.from(c.byResponsible.entries()).map(([responsible, count]) => ({ responsible, count })).sort((a, b) => b.count - a.count),
      byStatus: Array.from(c.byStatus.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.total - a.total);

  res.json(result);
});
