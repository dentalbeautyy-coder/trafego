import { Router } from "express";
import { pool } from "../config/db.js";

export const leadsRouter = Router();

leadsRouter.get("/", async (req, res) => {
  const { campaignId } = req.query;
  const params = [];
  let filter = "";
  if (campaignId) {
    params.push(campaignId);
    filter = `WHERE pl.campaign_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT pl.*, c.name AS campaign_name, c.source AS campaign_source
     FROM patient_leads pl
     JOIN campaigns c ON c.id = pl.campaign_id
     ${filter}
     ORDER BY pl.received_at DESC`,
    params
  );
  res.json(rows);
});

leadsRouter.post("/", async (req, res) => {
  const { campaignId, patientName, phone, sourceChannel, createdBy } = req.body;
  if (!campaignId || !patientName) {
    return res.status(400).json({ error: "campaignId e patientName são obrigatórios" });
  }
  const { rows } = await pool.query(
    `INSERT INTO patient_leads (campaign_id, patient_name, phone, source_channel, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)
     RETURNING *`,
    [campaignId, patientName, phone || null, sourceChannel || "whatsapp", createdBy || null]
  );
  res.status(201).json(rows[0]);
});

// Atualização parcial das etapas do funil (agendou / compareceu / fechou / valor vendido).
leadsRouter.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const allowed = ["scheduled", "attended", "closed", "sale_value", "notes"];
  const updates = [];
  const params = [];

  for (const field of allowed) {
    if (field in req.body) {
      params.push(req.body[field]);
      updates.push(`${field} = $${params.length}`);
      // Marca o timestamp correspondente quando a etapa vira true
      if (["scheduled", "attended", "closed"].includes(field) && req.body[field] === true) {
        updates.push(`${field}_at = now()`);
      }
    }
  }
  if (!updates.length) {
    return res.status(400).json({ error: "nenhum campo válido para atualizar" });
  }
  params.push(req.body.updatedBy || null);
  updates.push(`updated_by = $${params.length}`);
  updates.push(`updated_at = now()`);
  params.push(id);

  const { rows } = await pool.query(
    `UPDATE patient_leads SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: "lead não encontrado" });
  res.json(rows[0]);
});
