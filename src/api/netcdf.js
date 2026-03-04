const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

/**
 * Fetch dataset metadata from FastAPI.
 * Returns variables, attributes, and available times.
 */
export async function getDatasets() {
  const r = await fetch(`${BASE}/datasets/metadata`);
  if (!r.ok) throw new Error("Failed to fetch datasets metadata");
  return await r.json(); // { dataset_title, variables, times, ... }
}

/**
 * Get list of available dates (ISO strings).
 * Just reuses the metadata endpoint.
 */
export async function getDates() {
  const meta = await getDatasets();
  return meta.times || [];
}

/**
 * Fetch a grid slice (lat/lon/values) for a given variable + date.
 * @param {string} variable - variable name, e.g. "precip"
 * @param {string} date - date string "YYYY-MM-DD"
 * @param {number} downsample - optional step for thinning grid
 */
export async function getGrid(variable, date, downsample = 2) {
  const url = new URL(`${BASE}/slice`);
  if (variable) url.searchParams.set("var", variable);
  if (date) url.searchParams.set("date", date);
  url.searchParams.set("downsample", downsample);

  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed to fetch grid slice");
  return await r.json(); // { lats, lons, values, units, ... }
}

/**
 * Fetch a time series for a given lat/lon point.
 * @param {number} lat - latitude
 * @param {number} lon - longitude
 * @param {string} variable - variable name
 */
export async function getTimeSeries(lat, lon, variable) {
  const url = new URL(`${BASE}/timeseries`);
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  if (variable) url.searchParams.set("var", variable);

  const r = await fetch(url);
  if (!r.ok) throw new Error("Failed to fetch timeseries");
  return await r.json(); // { data: [{time, value}], plotly_json, ... }
}
