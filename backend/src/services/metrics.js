import { pool } from "../config/db.js";

// Métricas por campanha. Investimento é sempre por período (from/to), vindo da Meta
// + gasto manual. Os números do funil (chegaram/agendaram/fecharam/valor) são
// contadores ACUMULADOS por anúncio, preenchidos manualmente — não são quebrados
// por dia, então representam o total até agora, não só o período do filtro.
export async function getCampaignMetrics({ from, to, campaignId }) {
  const params = [from, to];
  let campaignFilter = "";
  if (campaignId) {
    params.push(campaignId);
    campaignFilter = `AND c.id = $${params.length}`;
  }

  const { rows } = await pool.query(
    `
    WITH spend AS (
      SELECT campaign_id, SUM(spend) AS meta_spend
      FROM campaign_insights_daily
      WHERE date BETWEEN $1 AND $2
      GROUP BY campaign_id
    ),
    manual_spend AS (
      SELECT campaign_id, SUM(amount) AS manual_spend
      FROM manual_daily_spend
      WHERE date BETWEEN $1 AND $2
      GROUP BY campaign_id
    ),
    funnel AS (
      SELECT
        ase.campaign_id,
        COALESCE(SUM(f.leads_arrived), 0) AS leads_arrived,
        COALESCE(SUM(f.scheduled_count), 0) AS scheduled_count,
        COALESCE(SUM(f.closed_count), 0) AS closed_count,
        COALESCE(SUM(f.sale_value_total), 0) AS revenue
      FROM ad_manual_funnel f
      JOIN ads a ON a.id = f.ad_id
      JOIN adsets ase ON ase.id = a.adset_id
      GROUP BY ase.campaign_id
    )
    SELECT
      c.id AS campaign_id,
      c.name,
      c.source,
      c.status,
      COALESCE(spend.meta_spend, 0) + COALESCE(manual_spend.manual_spend, 0) AS investment,
      COALESCE(funnel.leads_arrived, 0) AS leads,
      COALESCE(funnel.scheduled_count, 0) AS scheduled,
      COALESCE(funnel.closed_count, 0) AS closed,
      COALESCE(funnel.revenue, 0) AS revenue
    FROM campaigns c
    LEFT JOIN spend ON spend.campaign_id = c.id
    LEFT JOIN manual_spend ON manual_spend.campaign_id = c.id
    LEFT JOIN funnel ON funnel.campaign_id = c.id
    WHERE 1=1 ${campaignFilter}
    ORDER BY investment DESC NULLS LAST
    `,
    params
  );

  return rows.map(deriveRatios);
}

function deriveRatios(row) {
  const investment = Number(row.investment);
  const leads = Number(row.leads);
  const scheduled = Number(row.scheduled);
  const closed = Number(row.closed);
  const revenue = Number(row.revenue);

  const safeDiv = (a, b) => (b > 0 ? a / b : null);

  return {
    campaignId: row.campaign_id,
    name: row.name,
    source: row.source,
    status: row.status,
    investment,
    leads,
    scheduled,
    closed,
    revenue,
    costPerLead: safeDiv(investment, leads),
    costPerScheduled: safeDiv(investment, scheduled),
    costPerClosed: safeDiv(investment, closed),
    roi: investment > 0 ? (revenue - investment) / investment : null,
    avgTicket: safeDiv(revenue, closed),
    conversionLeadToScheduled: safeDiv(scheduled, leads),
    conversionScheduledToClosed: safeDiv(closed, scheduled),
    conversionLeadToClosed: safeDiv(closed, leads),
  };
}
