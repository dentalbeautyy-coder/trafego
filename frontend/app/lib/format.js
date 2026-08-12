export function money(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function percent(value) {
  if (value === null || value === undefined) return "—";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function number(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("pt-BR");
}

export function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
