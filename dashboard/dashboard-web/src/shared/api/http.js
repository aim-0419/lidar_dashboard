import { apiUrl } from "./config";

async function parseJson(response) {
  return response.json().catch(() => ({}));
}

export async function getJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    ...options,
  });
  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.error || data.message || `GET ${path} failed`);
  }

  return data;
}

export async function postJson(path, body = {}, options = {}) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: JSON.stringify(body),
    ...options,
  });
  const data = await parseJson(response);

  if (!response.ok || data.ok === false || data.success === false) {
    throw new Error(data.error || data.message || `POST ${path} failed`);
  }

  return data;
}
