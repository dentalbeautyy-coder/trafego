import { Router } from "express";
import { fetchAccount, fetchUsers, fetchPipelines, fetchLeadsCustomFields, fetchLeadsPage } from "../services/kommoClient.js";

export const kommoDebugRouter = Router();

// Diagnóstico temporário — inspecionar a estrutura real da conta Kommo
// (usuários, funis/status, campos customizados, exemplo de lead) antes de
// desenhar o schema definitivo. Remover depois de mapear os campos certos.
kommoDebugRouter.get("/inspect", async (req, res) => {
  try {
    const [account, users, pipelines, customFields, leadsPage] = await Promise.all([
      fetchAccount().catch((e) => ({ error: e.message })),
      fetchUsers().catch((e) => ({ error: e.message })),
      fetchPipelines().catch((e) => ({ error: e.message })),
      fetchLeadsCustomFields().catch((e) => ({ error: e.message })),
      fetchLeadsPage(1, 3).catch((e) => ({ error: e.message })),
    ]);
    res.json({ account, users, pipelines, customFields, sampleLeads: leadsPage });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
