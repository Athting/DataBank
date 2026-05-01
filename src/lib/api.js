const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

const isLocalApiUrl = (url) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api\/?$/i.test(
    String(url ?? "").trim(),
  );

const shouldUseDevProxy =
  import.meta.env.DEV && (!configuredApiUrl || isLocalApiUrl(configuredApiUrl));

const apiBaseUrl = (
  shouldUseDevProxy
    ? "/api"
    : configuredApiUrl || "http://localhost:4000/api"
).replace(/\/$/, "");

export const isApiConfigured = Boolean(configuredApiUrl);

async function requestJson(path) {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }
  return response.json();
}

export async function fetchMaterials(params) {
  const query = new URLSearchParams();

  if (params?.q) query.set("q", params.q);
  if (typeof params?.minZt === "number" && Number.isFinite(params.minZt))
    query.set("minZt", String(params.minZt));
  if (typeof params?.maxZt === "number" && Number.isFinite(params.maxZt))
    query.set("maxZt", String(params.maxZt));
  if (params?.category) query.set("category", params.category);
  if (params?.includeTemp) query.set("includeTemp", "true");
  if (params?.limit) query.set("limit", String(params.limit));
  if (
    typeof params?.skip === "number" &&
    Number.isFinite(params.skip) &&
    params.skip >= 0
  ) {
    query.set("skip", String(params.skip));
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson(`/materials${suffix}`);
}

export async function searchMaterialNames(q, limit = 20) {
  const query = new URLSearchParams();
  if (q.trim()) query.set("q", q.trim());
  query.set("limit", String(limit));

  return requestJson(`/materials/names?${query.toString()}`);
}

export async function fetchMaterialByName(name) {
  return requestJson(`/materials/${encodeURIComponent(name)}`);
}

export async function fetchMaterialsByNames(names) {
  if (names.length === 0) return [];

  const query = new URLSearchParams();
  query.set("names", names.join(","));

  return requestJson(`/materials/by-names?${query.toString()}`);
}
