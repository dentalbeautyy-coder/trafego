"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/format";

const SOURCE_CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "meta_lead_form", label: "Formulário Meta" },
  { value: "site", label: "Site" },
  { value: "indicacao", label: "Indicação" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
];

export default function LeadsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [sourceChannel, setSourceChannel] = useState("whatsapp");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [campaignsData, leadsData] = await Promise.all([api.getCampaigns(), api.getLeads()]);
      setCampaigns(campaignsData);
      setLeads(leadsData);
      if (!campaignId && campaignsData.length) setCampaignId(String(campaignsData[0].id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!patientName.trim() || !campaignId) return;
    setCreating(true);
    setError(null);
    try {
      await api.createLead({
        campaignId: Number(campaignId),
        patientName: patientName.trim(),
        phone: phone.trim() || null,
        sourceChannel,
      });
      setPatientName("");
      setPhone("");
      const leadsData = await api.getLeads();
      setLeads(leadsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleStep(lead, field) {
    setError(null);
    try {
      const updated = await api.updateLead(lead.id, { [field]: !lead[field] });
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...updated } : l)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveSaleValue(lead, value) {
    setError(null);
    try {
      const updated = await api.updateLead(lead.id, { sale_value: value === "" ? null : Number(value) });
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...updated } : l)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Leads / pacientes</h1>
        <p>Cadastro e acompanhamento manual do funil: agendou → compareceu → fechou → valor vendido.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div className="section-title">Novo lead</div>
        <form className="form-grid" onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="patient-name">Nome do paciente</label>
            <input id="patient-name" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Nome" />
          </div>
          <div className="field">
            <label htmlFor="phone">Telefone</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(21) 90000-0000" />
          </div>
          <div className="field">
            <label htmlFor="campaign">Campanha</label>
            <select id="campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.source === "manual" ? "(manual)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="channel">Canal</label>
            <select id="channel" value={sourceChannel} onChange={(e) => setSourceChannel(e.target.value)}>
              {SOURCE_CHANNELS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={creating || !patientName.trim() || !campaignId}>
            {creating ? "Salvando…" : "Cadastrar lead"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="section-title">Funil</div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Campanha</th>
                <th>Canal</th>
                <th>Agendou</th>
                <th>Compareceu</th>
                <th>Fechou</th>
                <th>Valor vendido</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.patient_name}</td>
                  <td>
                    {lead.campaign_name}{" "}
                    <span className="source-tag">{lead.campaign_source === "manual" ? "(manual)" : ""}</span>
                  </td>
                  <td className="muted">{SOURCE_CHANNELS.find((s) => s.value === lead.source_channel)?.label || lead.source_channel}</td>
                  <td>
                    <input type="checkbox" checked={lead.scheduled} onChange={() => toggleStep(lead, "scheduled")} />
                  </td>
                  <td>
                    <input type="checkbox" checked={lead.attended} onChange={() => toggleStep(lead, "attended")} />
                  </td>
                  <td>
                    <input type="checkbox" checked={lead.closed} onChange={() => toggleStep(lead, "closed")} />
                  </td>
                  <td>
                    {lead.closed ? (
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={lead.sale_value ?? ""}
                        placeholder="0,00"
                        style={{ width: 100 }}
                        onBlur={(e) => saveSaleValue(lead, e.target.value)}
                      />
                    ) : (
                      <span className="muted">{money(lead.sale_value)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && leads.length === 0 && <div className="empty">Nenhum lead cadastrado ainda.</div>}
        </div>
      </div>
    </>
  );
}
