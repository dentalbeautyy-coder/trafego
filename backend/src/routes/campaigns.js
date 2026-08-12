import { Router } from "express";
import { pool } from "../config/db.js";

export const campaignsRouter = Router();

// Lista campanhas com o somatório dos contadores manuais preenchidos nos seus anúncios
// (chegaram/agendaram/fecharam/valor vendido), além do orçamento/dia vindo da Meta.
campaignsRouter.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       c.id, c.source, c.name, c.status, c.objective, c.meta_campaign_id,
       c.daily_budget, c.lifetime_budget, c.created_time,
       COALESCE(funnel.leads_arrived, 0) AS leads_arrived,
       COALESCE(funnel.scheduled_count, 0) AS scheduled_count,
       COALESCE(funnel.closed_count, 0) AS closed_count,
       COALESCE(funnel.sale_value_total, 0) AS sale_value_total
     FROM campaigns c
     LEFT JOIN (
       SELECT
         ase.campaign_id,
         SUM(f.leads_arrived) AS leads_arrived,
         SUM(f.scheduled_count) AS scheduled_count,
         SUM(f.closed_count) AS closed_count,
         SUM(f.sale_value_total) AS sale_value_total
       FROM ad_manual_funnel f
       JOIN ads a ON a.id = f.ad_id
       JOIN adsets ase ON ase.id = a.adset_id
       GROUP BY ase.campaign_id
     ) funnel ON funnel.campaign_id = c.id
     ORDER BY c.created_time DESC NULLS LAST, c.id DESC`
  );
  res.json(rows);
});

// Cria campanha manual (indicação, evento etc.) — nunca recebe sync automático.
campaignsRouter.post("/manual", async (req, res) => {
  const { name, createdBy } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name é obrigatório" });
  }
  const { rows } = await pool.query(
    `INSERT INTO campaigns (source, name, status, created_by, created_time)
     VALUES ('manual', $1, 'active', $2, now())
     RETURNING id, source, name, status, created_time`,
    [name.trim(), createdBy || null]
  );
  res.status(201).json(rows[0]);
});

// Detalhe de uma campanha: seus anúncios, com leads automáticos da Meta (se houver
// formulário nativo) e os contadores manuais acumulados (chegaram/agendaram/fecharam/valor).
campaignsRouter.get("/:id/detail", async (req, res) => {
  const { id } = req.params;

  const campaignRes = await pool.query(`SELECT * FROM campaigns WHERE id = $1`, [id]);
  if (!campaignRes.rows.length) return res.status(404).json({ error: "campanha não encontrada" });

  const adsRes = await pool.query(
    `SELECT
       a.id, a.name, a.status, a.creative_thumbnail_url,
       ase.name AS adset_name,
       COALESCE(spend.total_spend, 0) AS spend,
       COALESCE(spend.total_clicks, 0) AS clicks,
       COALESCE(spend.total_impressions, 0) AS impressions,
       COALESCE(ml.leads_from_meta, 0) AS leads_from_meta,
       COALESCE(f.leads_arrived, 0) AS leads_arrived,
       COALESCE(f.scheduled_count, 0) AS scheduled_count,
       COALESCE(f.closed_count, 0) AS closed_count,
       COALESCE(f.sale_value_total, 0) AS sale_value_total,
       f.updated_by, f.updated_at
     FROM ads a
     JOIN adsets ase ON ase.id = a.adset_id
     LEFT JOIN ad_manual_funnel f ON f.ad_id = a.id
     LEFT JOIN (
       SELECT ad_id, COUNT(*) AS leads_from_meta FROM meta_leads GROUP BY ad_id
     ) ml ON ml.ad_id = a.id
     LEFT JOIN (
       -- soma todo o período já sincronizado (não só o período do filtro da Visão
       -- Geral) — representa "quanto esse anúncio já gastou/gerou de cliques até agora".
       SELECT ad_id, SUM(spend) AS total_spend, SUM(clicks) AS total_clicks, SUM(impressions) AS total_impressions
       FROM campaign_insights_daily
       WHERE ad_id IS NOT NULL
       GROUP BY ad_id
     ) spend ON spend.ad_id = a.id
     WHERE ase.campaign_id = $1
     ORDER BY a.name`,
    [id]
  );

  res.json({ campaign: campaignRes.rows[0], ads: adsRes.rows });
});
