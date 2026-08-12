"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { money, number } from "../lib/format";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [onlyActive, setOnlyActive] = useState(true);

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

  const visibleCampaigns = useMemo(
    () => (onlyActive ? campaigns.filter((c) => c.status === "ACTIVE") : campaigns),
    [campaigns, onlyActive]
  );

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
        <div className="card-pad" style={{ paddingBottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>
            {onlyActive ? "Campanhas ativas" : "Todas as campanhas"} ({visibleCampaigns.length})
          </div>
          <button className="secondary" onClick={() => setOnlyActive((v) => !v)}>
            {onlyActive ? "Mostrar todas" : "Mostrar só ativas"}
          </button>
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
                <th>Chegaram</th>
                <th>Agendamentos</th>
                <th>Fechamentos</th>
                <th>Valor vendido</th>
              </tr>
            </thead>
            <tbody>
              {visibleCampaigns.map((c) => (
                <CampaignRow
                  key={c.id}
                  campaign={c}
                  expanded={expandedId === c.id}
                  onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                />
              ))}
            </tbody>
          </table>
          {!loading && visibleCampaigns.length === 0 && (
            <div className="empty">{onlyActive ? "Nenhuma campanha ativa no momento." : "Nenhuma campanha cadastrada ainda."}</div>
          )}
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
        <td>{number(campaign.leads_arrived)}</td>
        <td>{number(campaign.scheduled_count)}</td>
        <td>{number(campaign.closed_count)}</td>
        <td>{money(campaign.sale_value_total)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} style={{ padding: 0, borderBottom: "1px solid var(--border)" }}>
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
  const [adsetFilter, setAdsetFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");

  useEffect(() => {
    api
      .getCampaignDetail(campaignId)
      .then(setDetail)
      .catch((err) => setError(err.message));
  }, [campaignId]);

  const adsetOptions = useMemo(() => {
    if (!detail) return [];
    return Array.from(new Set(detail.ads.map((ad) => ad.adset_name))).sort();
  }, [detail]);

  const filteredAds = useMemo(() => {
    if (!detail) return [];
    return detail.ads.filter((ad) => {
      const matchesAdset = !adsetFilter || ad.adset_name === adsetFilter;
      const matchesName = !nameFilter || ad.name.toLowerCase().includes(nameFilter.toLowerCase());
      return matchesAdset && matchesName;
    });
  }, [detail, adsetFilter, nameFilter]);

  // Agrupa os anúncios filtrados por conjunto, na ordem em que os conjuntos aparecem.
  const groups = useMemo(() => {
    const map = new Map();
    for (const ad of filteredAds) {
      if (!map.has(ad.adset_id)) {
        map.set(ad.adset_id, { adsetId: ad.adset_id, adsetName: ad.adset_name, dailyBudget: ad.adset_daily_budget, ads: [] });
      }
      map.get(ad.adset_id).ads.push(ad);
    }
    return Array.from(map.values()).sort((a, b) => a.adsetName.localeCompare(b.adsetName));
  }, [filteredAds]);

  const campaignTotal = useMemo(() => {
    if (!detail) return null;
    return detail.ads.reduce(
      (acc, ad) => {
        acc.spend += Number(ad.spend) || 0;
        acc.clicks += Number(ad.clicks) || 0;
        acc.leadsFromMeta += Number(ad.leads_from_meta) || 0;
        acc.leadsArrived += Number(ad.leads_arrived) || 0;
        acc.scheduled += Number(ad.scheduled_count) || 0;
        acc.closed += Number(ad.closed_count) || 0;
        acc.revenue += Number(ad.sale_value_total) || 0;
        return acc;
      },
      { spend: 0, clicks: 0, leadsFromMeta: 0, leadsArrived: 0, scheduled: 0, closed: 0, revenue: 0 }
    );
  }, [detail]);

  if (error) return <div className="error-banner" style={{ margin: 16 }}>{error}</div>;
  if (!detail) return <div className="empty">Carregando anúncios…</div>;
  if (!detail.ads.length) return <div className="empty">Essa campanha ainda não tem anúncios sincronizados.</div>;

  const campaignCostPerClick = campaignTotal.clicks > 0 ? campaignTotal.spend / campaignTotal.clicks : null;
  const campaignCostPerRealLead = campaignTotal.leadsArrived > 0 ? campaignTotal.spend / campaignTotal.leadsArrived : null;

  return (
    <div style={{ background: "var(--bg)", padding: 16 }}>
      <div className="card card-pad" style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 24, fontSize: 13 }}>
        <SubtotalItem label="Gasto total (Meta)" value={money(campaignTotal.spend)} />
        <SubtotalItem label="Cliques (Meta)" value={number(campaignTotal.clicks)} />
        <SubtotalItem label="Leads (Meta)" value={number(campaignTotal.leadsFromMeta)} />
        <SubtotalItem label="Custo/clique" value={money(campaignCostPerClick)} />
        <SubtotalItem label="Custo/lead real" value={money(campaignCostPerRealLead)} />
        <SubtotalItem label="Chegaram" value={number(campaignTotal.leadsArrived)} />
        <SubtotalItem label="Agendamentos" value={number(campaignTotal.scheduled)} />
        <SubtotalItem label="Fechamentos" value={number(campaignTotal.closed)} />
        <SubtotalItem label="Valor vendido" value={money(campaignTotal.revenue)} />
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="field">
          <label htmlFor={`adset-filter-${campaignId}`}>Conjunto</label>
          <select id={`adset-filter-${campaignId}`} value={adsetFilter} onChange={(e) => setAdsetFilter(e.target.value)}>
            <option value="">Todos os conjuntos</option>
            {adsetOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`name-filter-${campaignId}`}>Buscar anúncio</label>
          <input
            id={`name-filter-${campaignId}`}
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Nome do anúncio"
            style={{ minWidth: 220 }}
          />
        </div>
        {(adsetFilter || nameFilter) && (
          <button
            className="secondary"
            onClick={() => {
              setAdsetFilter("");
              setNameFilter("");
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {!filteredAds.length && <div className="empty">Nenhum anúncio corresponde ao filtro.</div>}

      {groups.map((group) => (
        <AdsetGroup key={group.adsetId} group={group} />
      ))}
    </div>
  );
}

function AdsetGroup({ group }) {
  const [showAds, setShowAds] = useState(false);
  const subtotal = useMemo(() => {
    return group.ads.reduce(
      (acc, ad) => {
        acc.spend += Number(ad.spend) || 0;
        acc.clicks += Number(ad.clicks) || 0;
        acc.leadsFromMeta += Number(ad.leads_from_meta) || 0;
        acc.leadsArrived += Number(ad.leads_arrived) || 0;
        acc.scheduled += Number(ad.scheduled_count) || 0;
        acc.closed += Number(ad.closed_count) || 0;
        acc.revenue += Number(ad.sale_value_total) || 0;
        return acc;
      },
      { spend: 0, clicks: 0, leadsFromMeta: 0, leadsArrived: 0, scheduled: 0, closed: 0, revenue: 0 }
    );
  }, [group.ads]);

  const costPerClick = subtotal.clicks > 0 ? subtotal.spend / subtotal.clicks : null;
  const costPerRealLead = subtotal.leadsArrived > 0 ? subtotal.spend / subtotal.leadsArrived : null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div
        className="card-pad"
        style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}
      >
        <div style={{ fontWeight: 700 }}>{group.adsetName}</div>
        <div className="muted" style={{ fontSize: 13 }}>Orçamento/dia: {money(group.dailyBudget)}</div>
        <button className="secondary" style={{ marginLeft: "auto" }} onClick={() => setShowAds((v) => !v)}>
          {showAds ? "Ocultar anúncios" : `Mostrar anúncios (${group.ads.length})`}
        </button>
      </div>

      <div className="card-pad" style={{ display: "flex", flexWrap: "wrap", gap: 24, borderBottom: "1px solid var(--border)", fontSize: 13 }}>
        <SubtotalItem label="Gasto (Meta)" value={money(subtotal.spend)} />
        <SubtotalItem label="Cliques (Meta)" value={number(subtotal.clicks)} />
        <SubtotalItem label="Leads (Meta)" value={number(subtotal.leadsFromMeta)} />
        <SubtotalItem label="Custo/clique" value={money(costPerClick)} />
        <SubtotalItem label="Custo/lead real" value={money(costPerRealLead)} />
        <SubtotalItem label="Chegaram" value={number(subtotal.leadsArrived)} />
        <SubtotalItem label="Agendamentos" value={number(subtotal.scheduled)} />
        <SubtotalItem label="Fechamentos" value={number(subtotal.closed)} />
        <SubtotalItem label="Valor vendido" value={money(subtotal.revenue)} />
      </div>

      {showAds && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Anúncio</th>
                <th>Gasto (Meta)</th>
                <th>Cliques (Meta)</th>
                <th>Leads (Meta)</th>
                <th>Chegaram de fato</th>
                <th>Agendamentos</th>
                <th>Fechamentos</th>
                <th>Valor vendido (total)</th>
              </tr>
            </thead>
            <tbody>
              {group.ads.map((ad) => (
                <AdFunnelRow key={ad.id} ad={ad} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubtotalItem({ label, value }) {
  return (
    <div>
      <div className="stat-label" style={{ fontSize: 10.5 }}>{label}</div>
      <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</div>
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
      <td className="muted">{money(ad.spend)}</td>
      <td className="muted">{number(ad.clicks)}</td>
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
