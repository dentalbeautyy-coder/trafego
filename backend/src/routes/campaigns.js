import { Router } from "express";
import { pool } from "../config/db.js";

export const campaignsRouter = Router();

campaignsRouter.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, source, name, status, objective, meta_campaign_id, daily_budget, lifetime_budget, created_time
     FROM campaigns ORDER BY created_time DESC NULLS LAST, id DESC`
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
       ase.daily_budget AS adset_daily_budget,
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
     WHERE ase.campaign_id = $1
     ORDER BY a.name`,
    [id]
  );

  res.json({ campaign: campaignRes.rows[0], ads: adsRes.rows });
});
