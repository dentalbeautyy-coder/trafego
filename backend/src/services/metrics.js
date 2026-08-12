import { pool } from "../config/db.js";

// Métricas por campanha, no período informado. Junta gasto (Meta + manual) com o funil manual.
// Todos os valores aqui são calculados — nenhum é digitado diretamente por ninguém.
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
    leads AS (
      SELECT
        campaign_id,
        COUNT(*) AS lead_count,
        COUNT(*) FILTER (WHERE scheduled) AS scheduled_count,
        COUNT(*) FILTER (WHERE attended) AS attended_count,
        COUNT(*) FILTER (WHERE closed) AS closed_count,
        COALESCE(SUM(sale_value) FILTER (WHERE closed), 0) AS revenue
      FROM patient_leads
      WHERE received_at::date BETWEEN $1 AND $2
      GROUP BY campaign_id
    )
    SELECT
      c.id AS campaign_id,
      c.name,
      c.source,
      c.status,
      COALESCE(spend.meta_spend, 0) + COALESCE(manual_spend.manual_spend, 0) AS investment,
      COALESCE(leads.lead_count, 0) AS leads,
      COALESCE(leads.scheduled_count, 0) AS scheduled,
      COALESCE(leads.attended_count, 0) AS attended,
      COALESCE(leads.closed_count, 0) AS closed,
      COALESCE(leads.revenue, 0) AS revenue
    FROM campaigns c
    LEFT JOIN spend ON spend.campaign_id = c.id
    LEFT JOIN manual_spend ON manual_spend.campaign_id = c.id
    LEFT JOIN leads ON leads.campaign_id = c.id
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
  const attended = Number(row.attended);
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
    attended,
    closed,
    revenue,
    costPerLead: safeDiv(investment, leads),
    costPerScheduled: safeDiv(investment, scheduled),
    costPerAttended: safeDiv(investment, attended),
    costPerClosed: safeDiv(investment, closed),
    roi: investment > 0 ? (revenue - investment) / investment : null,
    avgTicket: safeDiv(revenue, closed),
    conversionLeadToScheduled: safeDiv(scheduled, leads),
    conversionScheduledToAttended: safeDiv(attended, scheduled),
    conversionAttendedToClosed: safeDiv(closed, attended),
    conversionLeadToClosed: safeDiv(closed, leads),
  };
}
