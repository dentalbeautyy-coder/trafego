import axios from "axios";
import "dotenv/config";

function client() {
  const subdomain = process.env.KOMMO_SUBDOMAIN;
  return axios.create({
    baseURL: `https://${subdomain}.kommo.com/api/v4`,
    headers: { Authorization: `Bearer ${process.env.KOMMO_ACCESS_TOKEN}` },
    timeout: 20000,
  });
}

async function get(path, params) {
  try {
    const res = await client().get(path, { params });
    return res.data;
  } catch (err) {
    const detail = err.response?.data?.detail || err.response?.data?.title || err.message;
    throw new Error(`Kommo API [${err.response?.status || "?"}] ${detail}`);
  }
}

export async function fetchUsers() {
  const data = await get("/users", { limit: 250 });
  return data._embedded?.users || [];
}

export async function fetchPipelinesWithStatuses() {
  const data = await get("/leads/pipelines");
  return data._embedded?.pipelines || [];
}

// Busca todos os leads criados no intervalo [fromTs, toTs] (unix seconds),
// seguindo paginação até a Kommo não devolver mais "next".
export async function fetchLeadsInRange(fromTs, toTs) {
  const leads = [];
  let page = 1;
  const limit = 250;

  while (true) {
    const data = await get("/leads", {
      page,
      limit,
      "filter[created_at][from]": fromTs,
      "filter[created_at][to]": toTs,
      with: "contacts",
    });
    const pageLeads = data._embedded?.leads || [];
    leads.push(...pageLeads);
    if (!data._links?.next || pageLeads.length < limit) break;
    page++;
  }
  return leads;
}
