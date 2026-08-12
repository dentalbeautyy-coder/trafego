"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
import { money, percent, number, isoDaysAgo } from "./lib/format";

const FUNNEL_STEPS = [
  { key: "leads", label: "Leads" },
  { key: "scheduled", label: "Agendados" },
  { key: "attended", label: "Compareceram" },
  { key: "closed", label: "Fecharam" },
];

export default function OverviewPage() {
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMetrics(from, to);
      setRows(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    const t = rows.reduce(
      (acc, r) => {
        acc.investment += Number(r.investment) || 0;
        acc.leads += r.leads || 0;
        acc.scheduled += r.scheduled || 0;
        acc.attended += r.attended || 0;
        acc.closed += r.closed || 0;
        acc.revenue += Number(r.revenue) || 0;
        return acc;
      },
      { investment: 0, leads: 0, scheduled: 0, attended: 0, closed: 0, revenue: 0 }
    );
    t.roi = t.investment > 0 ? (t.revenue - t.investment) / t.investment : null;
    t.cpl = t.leads > 0 ? t.investment / t.leads : null;
    t.cac = t.closed > 0 ? t.investment / t.closed : null;
    return t;
  }, [rows]);

  const maxFunnelValue = totals.leads || 1;

  return (
    <>
      <div className="page-header">
        <h1>Visão geral</h1>
        <p>Investimento vem da Meta automaticamente; leads, agendamentos, comparecimentos e fechamentos são preenchidos manualmente pela equipe.</p>
      </div>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="from">De</label>
          <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="to">Até</label>
          <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="secondary" onClick={load} disabled={loading}>
          {loading ? "Carregando…" : "Atualizar"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="stat-grid">
        <Stat label="Investimento total" value={money(totals.investment)} />
        <Stat label="Leads" value={number(totals.leads)} />
        <Stat label="Agendamentos" value={number(totals.scheduled)} />
        <Stat label="Comparecimentos" value={number(totals.attended)} />
        <Stat label="Fechamentos" value={number(totals.closed)} />
        <Stat label="Faturamento" value={money(totals.revenue)} />
        <Stat label="Custo por lead" value={money(totals.cpl)} />
        <Stat label="Custo por fechamento" value={money(totals.cac)} />
        <Stat
          label="ROI"
          value={percent(totals.roi)}
          tone={totals.roi === null ? undefined : totals.roi >= 0 ? "pos" : "neg"}
        />
      </div>

      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div className="section-title">Funil consolidado</div>
        <div className="funnel">
          {FUNNEL_STEPS.map((step) => (
            <div className="funnel-row" key={step.key}>
              <div className="funnel-label">{step.label}</div>
              <div className="funnel-track">
                <div
                  className="funnel-fill"
                  style={{ width: `${Math.min(100, (totals[step.key] / maxFunnelValue) * 100)}%` }}
                />
              </div>
              <div className="funnel-value">{number(totals[step.key])}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="section-title">Campanhas no período</div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Origem</th>
                <th>Status</th>
                <th>Investimento</th>
                <th>Leads</th>
                <th>CPL</th>
                <th>Fechamentos</th>
                <th>Custo/fechamento</th>
                <th>Faturamento</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.campaignId}>
                  <td>{r.name}</td>
                  <td>
                    <span className={`pill ${r.source}`}>{r.source === "meta" ? "Meta" : "Manual"}</span>
                  </td>
                  <td>
                    <span className={`pill ${String(r.status).toLowerCase()}`}>{r.status}</span>
                  </td>
                  <td>{money(r.investment)}</td>
                  <td>{number(r.leads)}</td>
                  <td>{money(r.costPerLead)}</td>
                  <td>{number(r.closed)}</td>
                  <td>{money(r.costPerClosed)}</td>
                  <td>{money(r.revenue)}</td>
                  <td>{percent(r.roi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && <div className="empty">Nenhuma campanha no período selecionado.</div>}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone || ""}`}>{value}</div>
    </div>
  );
}
