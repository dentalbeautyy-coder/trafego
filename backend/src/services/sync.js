import { pool } from "../config/db.js";
import {
  fetchCampaigns,
  fetchAllAdSets,
  fetchAllAds,
  fetchAllInsightsDaily,
  fetchAllAdInsightsDaily,
} from "./metaClient.js";
import "dotenv/config";

// Sincroniza campanhas/conjuntos/anúncios/insights da conta configurada.
// Idempotente: upsert por chave única (meta_*_id, ou campaign+adset+ad+date para insights).
// Busca cada tipo de dado para a CONTA INTEIRA em poucas chamadas paginadas —
// nunca uma chamada por campanha, para não estourar o rate limit da Meta em
// contas com muitas campanhas.
export async function runSync({ triggeredBy, daysBack = 7 }) {
  const logRes = await pool.query(
    `INSERT INTO sync_logs (triggered_by, status) VALUES ($1, 'running') RETURNING id`,
    [triggeredBy]
  );
  const logId = logRes.rows[0].id;

  let recordsInserted = 0;
  let recordsSkippedDuplicate = 0;

  try {
    const adAccountId = process.env.META_AD_ACCOUNT_ID;

    // 1) Campanhas — upsert todas, guarda mapa meta_campaign_id -> id interno
    const metaCampaigns = await fetchCampaigns(adAccountId);
    const campaignIdMap = new Map(); // meta_campaign_id -> id interno
    for (const mc of metaCampaigns) {
      const row = await upsertCampaign(mc);
      campaignIdMap.set(mc.id, row.id);
    }

    // 2) Conjuntos — uma chamada para a conta toda
    const metaAdSets = await fetchAllAdSets(adAccountId);
    const adsetIdMap = new Map(); // meta_adset_id -> id interno
    for (const as of metaAdSets) {
      const campaignId = campaignIdMap.get(as.campaign_id);
      if (!campaignId) continue; // conjunto de campanha fora do escopo sincronizado
      const row = await upsertAdset(as, campaignId);
      adsetIdMap.set(as.id, row.id);
    }

    // 3) Anúncios — uma chamada para a conta toda
    const metaAds = await fetchAllAds(adAccountId);
    const adIdMap = new Map(); // meta_ad_id -> id interno
    for (const ad of metaAds) {
      const adsetId = adsetIdMap.get(ad.adset_id);
      if (!adsetId) continue;
      const row = await upsertAd(ad, adsetId);
      adIdMap.set(ad.id, row.id);
    }

    // 4) Insights diários por CAMPANHA — usados no cálculo de investimento/ROI da Visão Geral
    const insights = await fetchAllInsightsDaily(adAccountId, daysBack);
    for (const insight of insights) {
      const campaignId = campaignIdMap.get(insight.campaign_id);
      if (!campaignId) continue;
      const result = await upsertInsight(
        { campaignId, adsetId: null, adId: null },
        insight
      );
      if (result === "inserted") recordsInserted++;
      else recordsSkippedDuplicate++;
    }

    // 5) Insights diários por ANÚNCIO — usados para mostrar gasto/cliques de cada
    // anúncio individual no painel da campanha (não entram no cálculo da Visão Geral,
    // que já soma pelo nível de campanha, para não contar o investimento em dobro).
    const adInsights = await fetchAllAdInsightsDaily(adAccountId, daysBack);
    let adInsightsUnmatched = 0;
    for (const insight of adInsights) {
      const campaignId = campaignIdMap.get(insight.campaign_id);
      const adsetId = adsetIdMap.get(insight.adset_id);
      const adId = adIdMap.get(insight.ad_id);
      if (!campaignId || !adsetId || !adId) {
        adInsightsUnmatched++;
        continue;
      }
      const result = await upsertInsight({ campaignId, adsetId, adId }, insight);
      if (result === "inserted") recordsInserted++;
      else recordsSkippedDuplicate++;
    }

    await pool.query(
      `UPDATE sync_logs SET status='success', finished_at=now(),
       campaigns_synced=$1, records_inserted=$2, records_skipped_duplicate=$3
       WHERE id=$4`,
      [campaignIdMap.size, recordsInserted, recordsSkippedDuplicate, logId]
    );

    return {
      status: "success",
      campaignsSynced: campaignIdMap.size,
      adsetsSynced: adsetIdMap.size,
      adsSynced: metaAds.length,
      adInsightsFetched: adInsights.length,
      adInsightsUnmatched,
      recordsInserted,
      recordsSkippedDuplicate,
    };
  } catch (err) {
    await pool.query(
      `UPDATE sync_logs SET status='failed', finished_at=now(), error_message=$1,
       records_inserted=$2, records_skipped_duplicate=$3
       WHERE id=$4`,
      [String(err.message || err), recordsInserted, recordsSkippedDuplicate, logId]
    );
    throw err;
  }
}

async function upsertCampaign(mc) {
  const res = await pool.query(
    `INSERT INTO campaigns (source, meta_campaign_id, name, objective, status,
       daily_budget, lifetime_budget, created_time, updated_time, last_synced_at)
     VALUES ('meta', $1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (meta_campaign_id) DO UPDATE SET
       name=EXCLUDED.name, objective=EXCLUDED.objective, status=EXCLUDED.status,
       daily_budget=EXCLUDED.daily_budget, lifetime_budget=EXCLUDED.lifetime_budget,
       updated_time=EXCLUDED.updated_time, last_synced_at=now()
     RETURNING id`,
    [
      mc.id,
      mc.name,
      mc.objective || null,
      mc.status || "UNKNOWN",
      mc.daily_budget ? Number(mc.daily_budget) / 100 : null, // Meta retorna em centavos
      mc.lifetime_budget ? Number(mc.lifetime_budget) / 100 : null,
      mc.created_time || null,
      mc.updated_time || null,
    ]
  );
  return res.rows[0];
}

async function upsertAdset(as, campaignId) {
  const res = await pool.query(
    `INSERT INTO adsets (meta_adset_id, campaign_id, name, status, daily_budget, created_time, last_synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (meta_adset_id) DO UPDATE SET
       name=EXCLUDED.name, status=EXCLUDED.status, daily_budget=EXCLUDED.daily_budget, last_synced_at=now()
     RETURNING id`,
    [as.id, campaignId, as.name, as.status || null, as.daily_budget ? Number(as.daily_budget) / 100 : null, as.created_time || null]
  );
  return res.rows[0];
}

async function upsertAd(ad, adsetId) {
  const res = await pool.query(
    `INSERT INTO ads (meta_ad_id, adset_id, name, status, creative_thumbnail_url, created_time, last_synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (meta_ad_id) DO UPDATE SET
       name=EXCLUDED.name, status=EXCLUDED.status,
       creative_thumbnail_url=EXCLUDED.creative_thumbnail_url, last_synced_at=now()
     RETURNING id`,
    [ad.id, adsetId, ad.name, ad.status || null, ad.creative?.thumbnail_url || null, ad.created_time || null]
  );
  return res.rows[0];
}

// Upsert em campaign_insights_daily, em qualquer nível (campanha, ou campanha+conjunto+anúncio).
// Retorna 'inserted' ou 'updated' apenas para contagem no log (a trava real contra
// duplicidade é o índice único idx_insights_dedup, que trata NULL como 0 — ver schema.sql
// para o porquê da constraint UNIQUE direta não funcionar com adset_id/ad_id nulos).
async function upsertInsight({ campaignId, adsetId, adId }, insight) {
  const res = await pool.query(
    `INSERT INTO campaign_insights_daily
       (campaign_id, adset_id, ad_id, date, spend, impressions, reach, clicks, cpc, cpm, ctr, frequency, results, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
     ON CONFLICT (campaign_id, (COALESCE(adset_id, 0)), (COALESCE(ad_id, 0)), date) DO UPDATE SET
       spend=EXCLUDED.spend, impressions=EXCLUDED.impressions, reach=EXCLUDED.reach,
       clicks=EXCLUDED.clicks, cpc=EXCLUDED.cpc, cpm=EXCLUDED.cpm, ctr=EXCLUDED.ctr,
       frequency=EXCLUDED.frequency, results=EXCLUDED.results, synced_at=now()
     RETURNING (xmax = 0) AS inserted`,
    [
      campaignId,
      adsetId,
      adId,
      insight.date_start,
      Number(insight.spend || 0),
      Number(insight.impressions || 0),
      Number(insight.reach || 0),
      Number(insight.clicks || 0),
      insight.cpc ? Number(insight.cpc) : null,
      insight.cpm ? Number(insight.cpm) : null,
      insight.ctr ? Number(insight.ctr) : null,
      insight.frequency ? Number(insight.frequency) : null,
      extractMessagingResults(insight.actions),
    ]
  );
  return res.rows[0].inserted ? "inserted" : "updated";
}

// A Meta não devolve um campo "resultados" pronto — o número que o Gerenciador de
// Anúncios mostra como "Resultados" (ex: "Conversas por mensagem") vem de dentro do
// array `actions`, filtrado pelo tipo de ação que bate com o objetivo da campanha.
// Para campanhas de conversa por WhatsApp/Messenger, é messaging_conversation_started.
const MESSAGING_RESULT_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
  "onsite_conversion.messaging_first_reply",
];

function extractMessagingResults(actions) {
  if (!Array.isArray(actions)) return 0;
  for (const type of MESSAGING_RESULT_ACTION_TYPES) {
    const match = actions.find((a) => a.action_type === type);
    if (match) return Number(match.value || 0);
  }
  return 0;
}
