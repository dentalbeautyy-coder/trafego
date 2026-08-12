import { Router } from "express";
import { pool } from "../config/db.js";

export const campaignsRouter = Router();

campaignsRouter.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, source, name, status, objective, meta_campaign_id, created_time
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
