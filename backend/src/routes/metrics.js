import { Router } from "express";
import { getCampaignMetrics } from "../services/metrics.js";

export const metricsRouter = Router();

metricsRouter.get("/", async (req, res) => {
  const { from, to, campaignId } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: "parâmetros from e to (YYYY-MM-DD) são obrigatórios" });
  }
  const rows = await getCampaignMetrics({ from, to, campaignId: campaignId || null });
  res.json(rows);
});
