import express from "express";
import cors from "cors";
import "dotenv/config";

import { campaignsRouter } from "./routes/campaigns.js";
import { leadsRouter } from "./routes/leads.js";
import { syncRouter } from "./routes/sync.js";
import { metricsRouter } from "./routes/metrics.js";
import { spendRouter } from "./routes/spend.js";
import { scheduleDailySync } from "./jobs/cron.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/campaigns", campaignsRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/sync", syncRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/spend", spendRouter);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend rodando na porta ${port}`);
  scheduleDailySync();
});
