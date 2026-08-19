"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { number, isoDaysAgo, timeAgo } from "../lib/format";

export default function KommoPage() {
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [overview, setOverview] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [selectedResponsible, setSelectedResponsible] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  useEffect(() => {
    load();
    loadLastSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function loadLastSync() {
    try {
      const data = await api.getKommoLastSync();
      setLastSyncedAt(data.lastSyncedAt);
    } catch {
      // silencioso — não é crítico pra tela funcionar
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, matrixData, campaignsData] = await Promise.all([
        api.getKommoOverview(from, to),
        api.getKommoMatrix(from, to),
        api.getKommoCampaigns(from, to),
      ]);
      setOverview(overviewData);
      setMatrix(matrixData);
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
      await loadLastSync();
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

  const responsibleOptions = useMemo(
    () => Array.from(new Set(matrix.map((m) => m.responsible))).sort(),
    [matrix]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(matrix.map((m) => m.status))).sort(),
    [matrix]
  );

  // Selecionar um status filtra quem apareceu nesse status; selecionar um
  // responsável filtra os status dele — os dois painéis se cruzam.
  const responsibleBreakdown = useMemo(() => {
    const filtered = matrix.filter((m) => !selectedStatus || m.status === selectedStatus);
    const totals = new Map();
    for (const row of filtered) totals.set(row.responsible, (totals.get(row.responsible) || 0) + row.count);
    return Array.from(totals.entries()).map(([responsible, count]) => ({ responsible, count })).sort((a, b) => b.count - a.count);
  }, [matrix, selectedStatus]);

  const statusBreakdown = useMemo(() => {
    const filtered = matrix.filter((m) => !selectedResponsible || m.responsible === selectedResponsible);
    const totals = new Map();
    for (const row of filtered) totals.set(row.status, (totals.get(row.status) || 0) + row.count);
    return Array.from(totals.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
  }, [matrix, selectedResponsible]);

  const maxResponsibleCount = useMemo(() => {
    if (!responsibleBreakdown.length) return 1;
    return Math.max(...responsibleBreakdown.map((r) => r.count));
  }, [responsibleBreakdown]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={handleSync} disabled={syncing}>
            {syncing ? "Sincronizando…" : "Sincronizar com a Kommo"}
          </button>
          {lastSyncedAt && (
            <span style={{ fontSize: 12.5, color: "var(--text-on-bg-muted)" }}>
              atualizado {timeAgo(lastSyncedAt)}
            </span>
          )}
        </div>
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

      <div className="toolbar toolbar-on-bg">
        <div className="field">
          <label htmlFor="filter-responsible">Filtrar por atendente</label>
          <select id="filter-responsible" value={selectedResponsible} onChange={(e) => setSelectedResponsible(e.target.value)}>
            <option value="">Todos os atendentes</option>
            {responsibleOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-status">Filtrar por status</label>
          <select id="filter-status" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {(selectedResponsible || selectedStatus) && (
          <button className="secondary" onClick={() => { setSelectedResponsible(""); setSelectedStatus(""); }}>
            Limpar filtros
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="card card-pad">
          <div className="section-title">
            Responsável pelo atendimento {selectedStatus && <span className="muted" style={{ fontWeight: 400 }}>— status: {selectedStatus}</span>}
          </div>
          {!responsibleBreakdown.length && <div className="empty">Sem dados no período.</div>}
          <div className="funnel">
            {responsibleBreakdown.map((r) => (
              <div
                className="funnel-row"
                key={r.responsible}
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedResponsible(selectedResponsible === r.responsible ? "" : r.responsible)}
              >
                <div className="funnel-label" style={{ fontWeight: selectedResponsible === r.responsible ? 800 : 600 }}>{r.responsible}</div>
                <div className="funnel-track">
                  <div className="funnel-fill" style={{ width: `${Math.min(100, (r.count / maxResponsibleCount) * 100)}%` }} />
                </div>
                <div className="funnel-value">{number(r.count)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-title">
            Status do atendimento {selectedResponsible && <span className="muted" style={{ fontWeight: 400 }}>— atendente: {selectedResponsible}</span>}
          </div>
          {!statusBreakdown.length && <div className="empty">Sem dados no período.</div>}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Leads</th>
                </tr>
              </thead>
              <tbody>
                {statusBreakdown.map((s) => (
                  <tr
                    key={s.status}
                    style={{ cursor: "pointer", fontWeight: selectedStatus === s.status ? 800 : 400 }}
                    onClick={() => setSelectedStatus(selectedStatus === s.status ? "" : s.status)}
                  >
                    <td>{s.status}</td>
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
