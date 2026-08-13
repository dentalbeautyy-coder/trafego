"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
import { money, percent, number, isoDaysAgo } from "./lib/format";
import { generateInsights } from "./lib/insights";

const FUNNEL_STEPS = [
  { key: "leads", label: "Chegaram" },
  { key: "scheduled", label: "Agendaram" },
  { key: "closed", label: "Fecharam" },
];

export default function OverviewPage() {
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(null); // null = todas selecionadas

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
      setSelectedIds(null); // nova busca reseta a seleção para "todas"
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function isSelected(id) {
    return selectedIds === null || selectedIds.has(id);
  }

  function toggleRow(id) {
    setSelectedIds((prev) => {
      const current = prev === null ? new Set(rows.map((r) => r.campaignId)) : new Set(prev);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return current;
    });
  }

  const selectedRows = useMemo(() => rows.filter((r) => isSelected(r.campaignId)), [rows, selectedIds]);

  const totals = useMemo(() => {
    const t = selectedRows.reduce(
      (acc, r) => {
        acc.investment += Number(r.investment) || 0;
        acc.clicks += r.clicks || 0;
        acc.results += r.results || 0;
        acc.leads += r.leads || 0;
        acc.scheduled += r.scheduled || 0;
        acc.closed += r.closed || 0;
        acc.revenue += Number(r.revenue) || 0;
        return acc;
      },
      { investment: 0, clicks: 0, results: 0, leads: 0, scheduled: 0, closed: 0, revenue: 0 }
    );
    t.roi = t.investment > 0 ? (t.revenue - t.investment) / t.investment : null;
    t.cpc = t.clicks > 0 ? t.investment / t.clicks : null;
    t.cpr = t.results > 0 ? t.investment / t.results : null;
    t.cpl = t.leads > 0 ? t.investment / t.leads : null;
    t.cps = t.scheduled > 0 ? t.investment / t.scheduled : null;
    t.cac = t.closed > 0 ? t.investment / t.closed : null;
    return t;
  }, [selectedRows]);

  const insights = useMemo(() => generateInsights({ totals, rows: selectedRows }), [totals, selectedRows]);

  const maxFunnelValue = totals.leads || 1;
  const allSelected = selectedIds === null;

  return (
    <>
      <div className="page-header">
        <h1>Visão geral</h1>
        <p>Investimento e conversas iniciadas vêm da Meta automaticamente ("Resultados" no Gerenciador de Anúncios). Custo por lead usa quem chegou de fato no CRM — mais confiável que qualquer métrica só da Meta. Agendamentos, fechamentos e valor vendido são contadores acumulados, preenchidos por anúncio (aba Campanhas).</p>
      </div>

      <div className="toolbar toolbar-on-bg">
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <Stat label="Investimento total" value={money(totals.investment)} big />
        </div>

        <Stat label="Conversas iniciadas (Meta)" value={number(totals.results)} />
        <Stat label="Custo por conversa" value={money(totals.cpr)} />

        <Stat label="Chegaram no CRM" value={number(totals.leads)} />
        <Stat label="Custo por lead que chegou" value={money(totals.cpl)} />

        <Stat label="Agendamentos" value={number(totals.scheduled)} />
        <Stat label="Custo por agendamento" value={money(totals.cps)} />

        <Stat label="Fechamentos" value={number(totals.closed)} />
        <Stat label="Custo por fechamento" value={money(totals.cac)} />

        <Stat label="Faturamento" value={money(totals.revenue)} />
        <Stat
          label="ROI"
          value={percent(totals.roi)}
          tone={totals.roi === null ? undefined : totals.roi >= 0 ? "pos" : "neg"}
        />
      </div>

      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div className="section-title">Insights</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {insights.map((insight, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span className={`pill ${insight.severity === "success" ? "success" : insight.severity === "warning" ? "warning" : "meta"}`} style={{ marginTop: 2, flexShrink: 0 }}>
                {insight.severity === "success" ? "Bom sinal" : insight.severity === "warning" ? "Atenção" : "Info"}
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{insight.title}</div>
                <div className="muted" style={{ fontSize: 13 }}>{insight.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div className="section-title">Funil consolidado {!allSelected && `(${selectedRows.length} campanha${selectedRows.length === 1 ? "" : "s"} selecionada${selectedRows.length === 1 ? "" : "s"})`}</div>
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
        <div className="card-pad" style={{ paddingBottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Campanhas no período — selecione quais entram nos totais acima</div>
          <button className="secondary" onClick={() => setSelectedIds(allSelected ? new Set() : null)}>
            {allSelected ? "Desmarcar todas" : "Selecionar todas"}
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th>Campanha</th>
                <th>Origem</th>
                <th>Status</th>
                <th>Investimento</th>
                <th>Conversas (Meta)</th>
                <th>Custo/conversa</th>
                <th>Chegaram</th>
                <th>Custo/lead</th>
                <th>Fechamentos</th>
                <th>Custo/fechamento</th>
                <th>Faturamento</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.campaignId} style={{ opacity: isSelected(r.campaignId) ? 1 : 0.45 }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isSelected(r.campaignId)}
                      onChange={() => toggleRow(r.campaignId)}
                    />
                  </td>
                  <td>{r.name}</td>
                  <td>
                    <span className={`pill ${r.source}`}>{r.source === "meta" ? "Meta" : "Manual"}</span>
                  </td>
                  <td>
                    <span className={`pill ${String(r.status).toLowerCase()}`}>{r.status}</span>
                  </td>
                  <td>{money(r.investment)}</td>
                  <td>{number(r.results)}</td>
                  <td>{money(r.costPerResult)}</td>
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

function Stat({ label, value, tone, big }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone || ""}`} style={big ? { fontSize: 30 } : undefined}>
        {value}
      </div>
    </div>
  );
}
