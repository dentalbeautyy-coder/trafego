const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `Erro ${res.status}`);
  }
  return res.json();
}

export const api = {
  getCampaigns: () => request("/api/campaigns"),
  createManualCampaign: (data) =>
    request("/api/campaigns/manual", { method: "POST", body: JSON.stringify(data) }),

  getLeads: (campaignId) =>
    request(`/api/leads${campaignId ? `?campaignId=${campaignId}` : ""}`),
  createLead: (data) => request("/api/leads", { method: "POST", body: JSON.stringify(data) }),
  updateLead: (id, data) =>
    request(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  getMetrics: (from, to, campaignId) =>
    request(`/api/metrics?from=${from}&to=${to}${campaignId ? `&campaignId=${campaignId}` : ""}`),

  runSync: () => request("/api/sync/run", { method: "POST" }),
  getSyncLogs: () => request("/api/sync/logs"),

  addManualSpend: (data) => request("/api/spend", { method: "POST", body: JSON.stringify(data) }),
};
