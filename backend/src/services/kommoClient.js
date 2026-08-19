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

export async function fetchAccount() {
  return get("/account", { with: "pipelines,users,custom_fields" });
}

export async function fetchUsers() {
  return get("/users");
}

export async function fetchPipelines() {
  return get("/leads/pipelines");
}

export async function fetchLeadsCustomFields() {
  return get("/leads/custom_fields");
}

// Busca leads paginados, com embed de contatos e responsável.
export async function fetchLeadsPage(page = 1, limit = 50) {
  return get("/leads", { page, limit, with: "contacts" });
}
