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

kommoRouter.get("/last-sync", async (req, res) => {
  const { rows } = await pool.query(`SELECT MAX(synced_at) AS last_synced_at FROM kommo_leads`);
  res.json({ lastSyncedAt: rows[0].last_synced_at });
});

// Diagnóstico temporário — conferir se negotiation_status_label está sendo gravado.
kommoRouter.get("/debug-sample", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, responsible_label, negotiation_status_label, campaign_label, status_id
     FROM kommo_leads ORDER BY kommo_created_at DESC LIMIT 10`
  );
  const { rows: counts } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE negotiation_status_label IS NOT NULL) AS with_label,
            COUNT(*) FILTER (WHERE negotiation_status_label IS NULL) AS without_label
     FROM kommo_leads`
  );
  res.json({ sample: rows, counts: counts[0] });
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
       COALESCE(l.negotiation_status_label, s.name, 'Sem status') AS status,
       COUNT(*) AS lead_count
     FROM kommo_leads l
     LEFT JOIN kommo_statuses s ON s.id = l.status_id
     WHERE l.kommo_created_at::date BETWEEN $1 AND $2
     GROUP BY 1
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
    byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.lead_count) })),
  });
});

// Cruzamento responsável x status — usado pro filtro que se cruza: selecionar um
// status mostra quem atendeu; selecionar um responsável mostra os status dele.
kommoRouter.get("/matrix", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "parâmetros from e to (YYYY-MM-DD) são obrigatórios" });

  const { rows } = await pool.query(
    `SELECT
       COALESCE(l.responsible_label, u.name, 'Sem responsável') AS responsible,
       COALESCE(l.negotiation_status_label, s.name, 'Sem status') AS status,
       COUNT(*) AS lead_count
     FROM kommo_leads l
     LEFT JOIN kommo_users u ON u.id = l.responsible_user_id
     LEFT JOIN kommo_statuses s ON s.id = l.status_id
     WHERE l.kommo_created_at::date BETWEEN $1 AND $2
     GROUP BY 1, 2`,
    [from, to]
  );

  res.json(rows.map((r) => ({ responsible: r.responsible, status: r.status, count: Number(r.lead_count) })));
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
       COALESCE(l.negotiation_status_label, s.name, 'Sem status') AS status,
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
