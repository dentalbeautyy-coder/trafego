"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money, number } from "../lib/format";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await api.getCampaigns());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await api.createManualCampaign({ name: name.trim() });
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Campanhas</h1>
        <p>Campanhas da Meta chegam automaticamente pela sincronização. Clique numa campanha para ver os anúncios e preencher os números do funil.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div className="section-title">Nova campanha manual</div>
        <form className="form-grid" onSubmit={handleCreate}>
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label htmlFor="campaign-name">Nome (ex: Indicação de pacientes, Evento Sorriso Novo)</label>
            <input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da campanha" />
          </div>
          <button type="submit" disabled={creating || !name.trim()}>
            {creating ? "Criando…" : "Criar campanha"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="section-title">Todas as campanhas</div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th>Nome</th>
                <th>Origem</th>
                <th>Status</th>
                <th>Orçamento/dia</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <CampaignRow
                  key={c.id}
                  campaign={c}
                  expanded={expandedId === c.id}
                  onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                />
              ))}
            </tbody>
          </table>
          {!loading && campaigns.length === 0 && <div className="empty">Nenhuma campanha cadastrada ainda.</div>}
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
        <td>{campaign.name}</td>
        <td>
          <span className={`pill ${campaign.source}`}>{campaign.source === "meta" ? "Meta" : "Manual"}</span>
        </td>
        <td>
          <span className={`pill ${String(campaign.status).toLowerCase()}`}>{campaign.status}</span>
        </td>
        <td>{money(campaign.daily_budget)}</td>
        <td className="muted">
          {campaign.created_time ? new Date(campaign.created_time).toLocaleDateString("pt-BR") : "—"}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0, borderBottom: "1px solid var(--border)" }}>
            <CampaignAdsPanel campaignId={campaign.id} />
          </td>
        </tr>
      )}
    </>
  );
}

function CampaignAdsPanel({ campaignId }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getCampaignDetail(campaignId)
      .then(setDetail)
      .catch((err) => setError(err.message));
  }, [campaignId]);

  if (error) return <div className="error-banner" style={{ margin: 16 }}>{error}</div>;
  if (!detail) return <div className="empty">Carregando anúncios…</div>;
  if (!detail.ads.length) return <div className="empty">Essa campanha ainda não tem anúncios sincronizados.</div>;

  return (
    <div style={{ background: "var(--bg)", padding: 16 }}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Anúncio</th>
              <th>Conjunto</th>
              <th>Orçamento/dia (conjunto)</th>
              <th>Leads (Meta)</th>
              <th>Chegaram de fato</th>
              <th>Agendamentos</th>
              <th>Fechamentos</th>
              <th>Valor vendido (total)</th>
            </tr>
          </thead>
          <tbody>
            {detail.ads.map((ad) => (
              <AdFunnelRow key={ad.id} ad={ad} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdFunnelRow({ ad }) {
  const [values, setValues] = useState({
    leads_arrived: ad.leads_arrived,
    scheduled_count: ad.scheduled_count,
    closed_count: ad.closed_count,
    sale_value_total: ad.sale_value_total,
  });
  const [saving, setSaving] = useState(false);

  async function save(field, value) {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) return;
    setValues((v) => ({ ...v, [field]: parsed }));
    setSaving(true);
    try {
      const payload = { updatedBy: null };
      const apiField = {
        leads_arrived: "leadsArrived",
        scheduled_count: "scheduledCount",
        closed_count: "closedCount",
        sale_value_total: "saleValueTotal",
      }[field];
      payload[apiField] = parsed;
      await api.updateAdFunnel(ad.id, payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{ad.name}</td>
      <td className="muted">{ad.adset_name}</td>
      <td className="muted">{money(ad.adset_daily_budget)}</td>
      <td className="muted">{number(ad.leads_from_meta)}</td>
      <td>
        <CountInput value={values.leads_arrived} onSave={(v) => save("leads_arrived", v)} disabled={saving} />
      </td>
      <td>
        <CountInput value={values.scheduled_count} onSave={(v) => save("scheduled_count", v)} disabled={saving} />
      </td>
      <td>
        <CountInput value={values.closed_count} onSave={(v) => save("closed_count", v)} disabled={saving} />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          min="0"
          defaultValue={values.sale_value_total}
          style={{ width: 110 }}
          disabled={saving}
          onBlur={(e) => save("sale_value_total", e.target.value)}
        />
      </td>
    </tr>
  );
}

function CountInput({ value, onSave, disabled }) {
  return (
    <input
      type="number"
      min="0"
      step="1"
      defaultValue={value}
      style={{ width: 70 }}
      disabled={disabled}
      onBlur={(e) => onSave(e.target.value)}
    />
  );
}
