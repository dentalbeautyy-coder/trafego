import { Router } from "express";
import { pool } from "../config/db.js";

export const spendRouter = Router();

// Investimento diário manual — usado para campanhas manuais (evento, indicação)
// ou quando o valor pago difere do reportado pela Meta.
spendRouter.post("/", async (req, res) => {
  const { campaignId, date, amount, enteredBy } = req.body;
  if (!campaignId || !date || amount == null) {
    return res.status(400).json({ error: "campaignId, date e amount são obrigatórios" });
  }
  const { rows } = await pool.query(
    `INSERT INTO manual_daily_spend (campaign_id, date, amount, entered_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (campaign_id, date) DO UPDATE SET amount = EXCLUDED.amount, entered_by = EXCLUDED.entered_by, entered_at = now()
     RETURNING *`,
    [campaignId, date, amount, enteredBy || null]
  );
  res.status(201).json(rows[0]);
});
