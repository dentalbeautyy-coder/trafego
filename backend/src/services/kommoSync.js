import { pool } from "../config/db.js";
import { fetchUsers, fetchPipelinesWithStatuses, fetchLeadsInRange } from "./kommoClient.js";

const CAMPAIGN_FIELD_NAME = "Campanhas/Parceiros";
const CHANNEL_FIELD_NAME = "Canal de Entrada";
const RESPONSIBLE_FIELD_NAME = "Responsável"; // campo customizado multiselect, existe 2x na conta
// A etapa do funil (status_id) quase sempre fica "SUPERVISÃO" pra todo mundo — pouco
// útil como "status do atendimento". O campo customizado "Status Negociação" tem os
// valores reais (Agendado, Em conversa, Mensagem inicial, Sem acordo etc.).
const NEGOTIATION_STATUS_FIELD_NAME = "Status Negociação";

export async function runKommoSync({ daysBack = 60 } = {}) {
  const toTs = Math.floor(Date.now() / 1000);
  const fromTs = toTs - daysBack * 86400;

  const users = await fetchUsers();
  for (const u of users) {
    await pool.query(
      `INSERT INTO kommo_users (id, name, synced_at) VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, synced_at = now()`,
      [u.id, u.name]
    );
  }

  const pipelines = await fetchPipelinesWithStatuses();
  for (const p of pipelines) {
    await pool.query(
      `INSERT INTO kommo_pipelines (id, name, synced_at) VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, synced_at = now()`,
      [p.id, p.name]
    );
    const statuses = p._embedded?.statuses || [];
    for (const s of statuses) {
      await pool.query(
        `INSERT INTO kommo_statuses (id, pipeline_id, name, color, synced_at) VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, pipeline_id = EXCLUDED.pipeline_id, synced_at = now()`,
        [s.id, p.id, s.name, s.color || null]
      );
    }
  }

  const leads = await fetchLeadsInRange(fromTs, toTs);
  let inserted = 0;
  for (const lead of leads) {
    const fields = lead.custom_fields_values || [];
    const campaignLabel = extractFieldValue(fields, CAMPAIGN_FIELD_NAME);
    const channelLabel = extractFieldValue(fields, CHANNEL_FIELD_NAME);
    const responsibleLabel = extractFieldValue(fields, RESPONSIBLE_FIELD_NAME);
    const negotiationStatusLabel = extractFieldValue(fields, NEGOTIATION_STATUS_FIELD_NAME);

    const res = await pool.query(
      `INSERT INTO kommo_leads
         (id, name, responsible_user_id, responsible_label, pipeline_id, status_id,
          campaign_label, channel_label, negotiation_status_label, kommo_created_at, kommo_updated_at, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10), to_timestamp($11), now())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         responsible_user_id = EXCLUDED.responsible_user_id,
         responsible_label = EXCLUDED.responsible_label,
         pipeline_id = EXCLUDED.pipeline_id,
         status_id = EXCLUDED.status_id,
         campaign_label = EXCLUDED.campaign_label,
         channel_label = EXCLUDED.channel_label,
         negotiation_status_label = EXCLUDED.negotiation_status_label,
         kommo_updated_at = EXCLUDED.kommo_updated_at,
         synced_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [
        lead.id,
        lead.name || null,
        lead.responsible_user_id || null,
        responsibleLabel,
        lead.pipeline_id || null,
        lead.status_id || null,
        campaignLabel,
        channelLabel,
        negotiationStatusLabel,
        lead.created_at,
        lead.updated_at,
      ]
    );
    if (res.rows[0].inserted) inserted++;
  }

  return {
    usersSynced: users.length,
    pipelinesSynced: pipelines.length,
    leadsFetched: leads.length,
    leadsInserted: inserted,
    leadsUpdated: leads.length - inserted,
  };
}

function extractFieldValue(customFieldsValues, fieldName) {
  const field = customFieldsValues.find((f) => f.field_name === fieldName && f.values?.length);
  if (!field) return null;
  return field.values.map((v) => v.value).join(", ");
}
