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

  getCampaignDetail: (campaignId) => request(`/api/campaigns/${campaignId}/detail`),
  updateAdFunnel: (adId, data) =>
    request(`/api/ads/${adId}/funnel`, { method: "PATCH", body: JSON.stringify(data) }),

  getMetrics: (from, to, campaignId) =>
    request(`/api/metrics?from=${from}&to=${to}${campaignId ? `&campaignId=${campaignId}` : ""}`),

  runSync: () => request("/api/sync/run", { method: "POST" }),
  getSyncLogs: () => request("/api/sync/logs"),

  addManualSpend: (data) => request("/api/spend", { method: "POST", body: JSON.stringify(data) }),

  runKommoSync: () => request("/api/kommo/sync", { method: "POST" }),
  getKommoOverview: (from, to) => request(`/api/kommo/overview?from=${from}&to=${to}`),
  getKommoCampaigns: (from, to) => request(`/api/kommo/campaigns?from=${from}&to=${to}`),
  getKommoLastSync: () => request("/api/kommo/last-sync"),
  getKommoMatrix: (from, to) => request(`/api/kommo/matrix?from=${from}&to=${to}`),
};
