"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { number, isoDaysAgo } from "../lib/format";

export default function KommoPage() {
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, campaignsData] = await Promise.all([
        api.getKommoOverview(from, to),
        api.getKommoCampaigns(from, to),
      ]);
      setOverview(overviewData);
      setCampaigns(campaignsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const result = await api.runKommoSync();
      setSyncResult(result);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  function toggleCampaign(name) {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const maxResponsibleCount = useMemo(() => {
    if (!overview?.byResponsible?.length) return 1;
    return Math.max(...overview.byResponsible.map((r) => r.count));
  }, [overview]);

  return (
    <>
      <div className="page-header">
        <h1>Kommo</h1>
        <p>Atendimento vindo do CRM: responsável por cada lead, status do atendimento e a campanha de origem (campo "Campanhas/Parceiros", preenchido pela equipe/robô ao receber o lead).</p>
      </div>

      <div className="toolbar toolbar-on-bg">
        <div className="field">
          <label htmlFor="kommo-from">De</label>
          <input id="kommo-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="kommo-to">Até</label>
          <input id="kommo-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="secondary" onClick={load} disabled={loading}>
          {loading ? "Carregando…" : "Atualizar"}
        </button>
        <button onClick={handleSync} disabled={syncing}>
          {syncing ? "Sincronizando…" : "Sincronizar com a Kommo"}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {syncResult && (
        <div className="card card-pad" style={{ marginBottom: 24, fontSize: 13 }}>
          Sincronizado: {syncResult.leadsFetched} leads no período ({syncResult.leadsInserted} novos, {syncResult.leadsUpdated} atualizados), {syncResult.usersSynced} usuários, {syncResult.pipelinesSynced} funis.
        </div>
      )}

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Total de leads</div>
          <div className="stat-value">{overview ? number(overview.total) : "—"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="card card-pad">
          <div className="section-title">Responsável pelo atendimento</div>
          {!overview?.byResponsible?.length && <div className="empty">Sem dados no período.</div>}
          <div className="funnel">
            {overview?.byResponsible?.map((r) => (
              <div className="funnel-row" key={r.responsible}>
                <div className="funnel-label">{r.responsible}</div>
                <div className="funnel-track">
                  <div className="funnel-fill" style={{ width: `${Math.min(100, (r.count / maxResponsibleCount) * 100)}%` }} />
                </div>
                <div className="funnel-value">{number(r.count)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-title">Status do atendimento</div>
          {!overview?.byStatus?.length && <div className="empty">Sem dados no período.</div>}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Funil</th>
                  <th>Leads</th>
                </tr>
              </thead>
              <tbody>
                {overview?.byStatus?.map((s) => (
                  <tr key={`${s.pipeline}-${s.status}`}>
                    <td>{s.status}</td>
                    <td className="muted">{s.pipeline}</td>
                    <td>{number(s.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="section-title">Por campanha</div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th>Campanha</th>
                <th>Leads recebidos</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <CampaignRow
                  key={c.campaign}
                  campaign={c}
                  expanded={expandedCampaigns.has(c.campaign)}
                  onToggle={() => toggleCampaign(c.campaign)}
                />
              ))}
            </tbody>
          </table>
          {!loading && campaigns.length === 0 && <div className="empty">Nenhum lead no período selecionado.</div>}
        </div>
      </div>
    </>
  );
}

function CampaignRow({ campaign, expanded, onToggle }) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }}>
        <td className="muted">{expanded ? "−" : "+"}</td>
        <td>{campaign.campaign}</td>
        <td>{number(campaign.total)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={3} style={{ padding: 0, borderBottom: "1px solid var(--border)" }}>
            <div style={{ background: "var(--bg-cream)", padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div className="stat-label" style={{ marginBottom: 8 }}>Responsável</div>
                <table>
                  <tbody>
                    {campaign.byResponsible.map((r) => (
                      <tr key={r.responsible}>
                        <td>{r.responsible}</td>
                        <td style={{ textAlign: "right" }}>{number(r.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="stat-label" style={{ marginBottom: 8 }}>Status</div>
                <table>
                  <tbody>
                    {campaign.byStatus.map((s) => (
                      <tr key={s.status}>
                        <td>{s.status}</td>
                        <td style={{ textAlign: "right" }}>{number(s.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
