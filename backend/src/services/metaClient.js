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
    const res = await http.get(url, { params: queryParams });
    results.push(...(res.data.data || []));
    const next = res.data.paging?.next;
    if (!next) break;
    url = next; // URL absoluta já inclui token e cursor; próxima chamada não reaplica params
    queryParams = undefined;
  }
  return results;
}

export async function fetchCampaigns(adAccountId) {
  return getAllPages(`/${adAccountId}/campaigns`, {
    fields: "id,name,objective,status,daily_budget,lifetime_budget,created_time,updated_time",
    limit: 100,
  });
}

export async function fetchAdSets(campaignId) {
  return getAllPages(`/${campaignId}/adsets`, {
    fields: "id,name,status,daily_budget,created_time",
    limit: 100,
  });
}

export async function fetchAds(adsetId) {
  return getAllPages(`/${adsetId}/ads`, {
    fields: "id,name,status,created_time,creative{thumbnail_url}",
    limit: 100,
  });
}

// Insights diários no nível de campanha, últimos `daysBack` dias (padrão 7 —
// cobre revisões tardias de métricas que a Meta às vezes faz no próprio dia/dia seguinte).
export async function fetchCampaignInsightsDaily(campaignId, daysBack = 7) {
  return getAllPages(`/${campaignId}/insights`, {
    fields: "spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,date_start,date_stop",
    time_increment: 1,
    date_preset: undefined,
    time_range: JSON.stringify({
      since: daysAgo(daysBack),
      until: daysAgo(0),
    }),
    limit: 100,
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
