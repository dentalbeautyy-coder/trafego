"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

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
        <p>Campanhas da Meta chegam automaticamente pela sincronização. Indicação, evento etc. entram aqui manualmente.</p>
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
                <th>Nome</th>
                <th>Origem</th>
                <th>Status</th>
                <th>Objetivo</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    <span className={`pill ${c.source}`}>{c.source === "meta" ? "Meta" : "Manual"}</span>
                  </td>
                  <td>
                    <span className={`pill ${String(c.status).toLowerCase()}`}>{c.status}</span>
                  </td>
                  <td className="muted">{c.objective || "—"}</td>
                  <td className="muted">
                    {c.created_time ? new Date(c.created_time).toLocaleDateString("pt-BR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && campaigns.length === 0 && <div className="empty">Nenhuma campanha cadastrada ainda.</div>}
        </div>
      </div>
    </>
  );
}
