import axios from "axios";
import "dotenv/config";

const API_VERSION = process.env.META_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

function client() {
  return axios.create({
    baseURL: BASE_URL,
    params: { access_token: process.env.META_SYSTEM_USER_TOKEN },
    timeout: 20000,
  });
}

// Segue paginação da Graph API até esgotar `paging.next`, concatenando `data`.
async function getAllPages(path, params) {
  const http = client();
  let url = path;
  let queryParams = params;
  const results = [];

  while (url) {
    try {
      const res = await http.get(url, { params: queryParams });
      results.push(...(res.data.data || []));
      const next = res.data.paging?.next;
      if (!next) break;
      url = next; // URL absoluta já inclui token e cursor; próxima chamada não reaplica params
      queryParams = undefined;
    } catch (err) {
      const metaError = err.response?.data?.error;
      if (metaError) {
        const detail = `Meta API [${metaError.code}${metaError.error_subcode ? "/" + metaError.error_subcode : ""}] ${metaError.message}${metaError.error_user_msg ? " — " + metaError.error_user_msg : ""}`;
        throw new Error(detail);
      }
      throw err;
    }
  }
  return results;
}

// Todas as funções abaixo buscam para a CONTA INTEIRA de uma vez (paginado),
// em vez de uma chamada por campanha/conjunto — contas com muitas campanhas
// (aqui, ~80) estouram o rate limit da Meta em segundos se cada campanha
// disparar suas próprias chamadas de conjuntos/anúncios/insights.

// Só campanhas ATIVAS ou PAUSADAS — ignora o arquivo histórico (campanhas
// arquivadas/excluídas/concluídas de anos atrás), que não precisa ser
// sincronizado. Inclui PAUSED (não só ACTIVE) para capturar a transição
// quando uma campanha ativa hoje for pausada depois.
export async function fetchCampaigns(adAccountId) {
  return getAllPages(`/${adAccountId}/campaigns`, {
    fields: "id,name,objective,status,daily_budget,lifetime_budget,created_time,updated_time",
    filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] }]),
    limit: 200,
  });
}

// Conjuntos de campanhas ativas/pausadas, cada um já trazendo o campaign_id a que pertence.
export async function fetchAllAdSets(adAccountId) {
  return getAllPages(`/${adAccountId}/adsets`, {
    fields: "id,name,status,daily_budget,created_time,campaign_id",
    filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] }]),
    limit: 200,
  });
}

// Anúncios de campanhas ativas/pausadas, cada um já trazendo o adset_id a que pertence.
export async function fetchAllAds(adAccountId) {
  return getAllPages(`/${adAccountId}/ads`, {
    fields: "id,name,status,created_time,adset_id,creative{thumbnail_url}",
    filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE", "PAUSED"] }]),
    limit: 200,
  });
}

// Insights diários por campanha, para TODA a conta em uma única série de chamadas
// paginadas (level=campaign, breakdown por dia). daysBack padrão 7 — cobre revisões
// tardias de métricas que a Meta às vezes faz no próprio dia/dia seguinte.
export async function fetchAllInsightsDaily(adAccountId, daysBack = 7) {
  return getAllPages(`/${adAccountId}/insights`, {
    level: "campaign",
    fields: "campaign_id,spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions,date_start,date_stop",
    time_increment: 1,
    time_range: JSON.stringify({
      since: daysAgo(daysBack),
      until: daysAgo(0),
    }),
    limit: 200,
  });
}

// Insights diários por ANÚNCIO (level=ad), para TODA a conta — usado para mostrar
// quanto cada anúncio individual já gastou e seus cliques, dentro do painel da campanha.
export async function fetchAllAdInsightsDaily(adAccountId, daysBack = 7) {
  return getAllPages(`/${adAccountId}/insights`, {
    level: "ad",
    fields: "ad_id,adset_id,campaign_id,spend,impressions,clicks,cpc,cpm,ctr,actions,date_start,date_stop",
    time_increment: 1,
    time_range: JSON.stringify({
      since: daysAgo(daysBack),
      until: daysAgo(0),
    }),
    limit: 200,
  });
}

export async function fetchLeadsForForm(formId, sinceUnixTs) {
  return getAllPages(`/${formId}/leads`, {
    fields: "id,created_time,field_data,campaign_id,adset_id,ad_id",
    filtering: sinceUnixTs
      ? JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: sinceUnixTs }])
      : undefined,
    limit: 100,
  });
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
