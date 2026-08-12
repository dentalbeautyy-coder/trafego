"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function SyncPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      setLogs(await api.getSyncLogs());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await api.runSync();
      setLastResult(result);
      await loadLogs();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Sincronização</h1>
        <p>Puxa campanhas, conjuntos, anúncios e investimento diário direto da Meta. Roda sozinha todo dia às 8h, ou dispare manualmente abaixo.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card card-pad" style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="section-title" style={{ marginBottom: 4 }}>Sincronizar agora</div>
          <div className="muted" style={{ fontSize: 13.5 }}>Busca os últimos 7 dias de dados da conta conectada.</div>
        </div>
        <button onClick={handleRun} disabled={running}>
          {running ? "Sincronizando…" : "Sincronizar com a Meta"}
        </button>
      </div>

      {lastResult && (
        <div className="card card-pad" style={{ marginBottom: 24 }}>
          <div className="section-title">Resultado</div>
          <div className="stat-grid">
            <MiniStat label="Status" value={<span className={`pill ${lastResult.status}`}>{statusLabel(lastResult.status)}</span>} />
            <MiniStat label="Campanhas" value={lastResult.campaignsSynced} />
            <MiniStat label="Conjuntos" value={lastResult.adsetsSynced} />
            <MiniStat label="Anúncios" value={lastResult.adsSynced} />
            <MiniStat label="Métricas inseridas" value={lastResult.recordsInserted} />
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="section-title">Histórico de sincronizações</div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Iniciada em</th>
                <th>Disparada por</th>
                <th>Status</th>
                <th>Campanhas</th>
                <th>Inseridos</th>
                <th>Erro</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.started_at).toLocaleString("pt-BR")}</td>
                  <td className="muted">{log.triggered_by === "cron_08h" ? "Automática (8h)" : "Manual"}</td>
                  <td>
                    <span className={`pill ${log.status}`}>{statusLabel(log.status)}</span>
                  </td>
                  <td>{log.campaigns_synced}</td>
                  <td>{log.records_inserted}</td>
                  <td className="muted" style={{ maxWidth: 320, whiteSpace: "normal" }}>
                    {log.error_message || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && logs.length === 0 && <div className="empty">Nenhuma sincronização registrada ainda.</div>}
        </div>
      </div>
    </>
  );
}

function statusLabel(status) {
  return { success: "Sucesso", partial: "Parcial", failed: "Falhou", running: "Rodando" }[status] || status;
}

function MiniStat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
