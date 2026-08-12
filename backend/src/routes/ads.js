import { Router } from "express";
import { pool } from "../config/db.js";

export const adsRouter = Router();

// Upsert dos contadores manuais acumulados de um anúncio
// (chegaram de fato / agendamentos / fechamentos / valor vendido).
adsRouter.patch("/:id/funnel", async (req, res) => {
  const { id } = req.params;
  const { leadsArrived, scheduledCount, closedCount, saleValueTotal, updatedBy } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO ad_manual_funnel (ad_id, leads_arrived, scheduled_count, closed_count, sale_value_total, updated_by, updated_at)
     VALUES ($1, COALESCE($2, 0), COALESCE($3, 0), COALESCE($4, 0), COALESCE($5, 0), $6, now())
     ON CONFLICT (ad_id) DO UPDATE SET
       leads_arrived = COALESCE($2, ad_manual_funnel.leads_arrived),
       scheduled_count = COALESCE($3, ad_manual_funnel.scheduled_count),
       closed_count = COALESCE($4, ad_manual_funnel.closed_count),
       sale_value_total = COALESCE($5, ad_manual_funnel.sale_value_total),
       updated_by = $6,
       updated_at = now()
     RETURNING *`,
    [
      id,
      leadsArrived ?? null,
      scheduledCount ?? null,
      closedCount ?? null,
      saleValueTotal ?? null,
      updatedBy || null,
    ]
  );
  res.json(rows[0]);
});
