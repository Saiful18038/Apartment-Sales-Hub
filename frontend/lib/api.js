// Default is a same-origin relative path — correct for the production build,
// which is served from Laravel's public/ on the same host as the API.
// `npm run dev` (port 3000) overrides this via .env.development.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

const TOKEN_KEY = "erp.token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Thrown for a blocked license response (403 {"error":"LICENSE_*"}) so
 * <AppShell> can show the same full-screen restricted state the React
 * prototype's <LicenseRestrictedScreen> showed — mirrors the roadmap's
 * License Middleware placeholder (App\Services\LicenseService on the API).
 */
export class LicenseBlockedError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "LicenseBlockedError";
    this.licenseStatus = status;
  }
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

let onLicenseStatusChange = null;
export function setLicenseStatusHandler(fn) {
  onLicenseStatusChange = fn;
}

let onLicenseBlocked = null;
export function setLicenseBlockedHandler(fn) {
  onLicenseBlocked = fn;
}

async function request(path, { method = "GET", body, auth = true, isFormData = false } = {}) {
  const headers = { Accept: "application/json" };
  // FormData sets its own multipart Content-Type (with boundary) — the
  // browser does that automatically only if we don't set one ourselves.
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  const licenseStatus = res.headers.get("X-License-Status");
  if (licenseStatus && onLicenseStatusChange) onLicenseStatusChange(licenseStatus);

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (res.status === 403 && data?.error?.startsWith("LICENSE_")) {
    const status = data.error.replace("LICENSE_", "");
    if (onLicenseBlocked) onLicenseBlocked(status, data.message);
    throw new LicenseBlockedError(status, data.message);
  }

  if (res.status === 401) {
    setToken(null);
    if (onUnauthorized) onUnauthorized();
    throw new ApiError(data?.message || "Unauthenticated.", 401, data);
  }

  if (!res.ok) {
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, data);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  postForm: (path, formData) => request(path, { method: "POST", body: formData, isFormData: true }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),
  login: (email, password) => request("/login", { method: "POST", body: { email, password }, auth: false }),

  /**
   * Roadmap Phase 14 — Document Management. Downloads require the Bearer
   * token, so a plain <a href> can't be used — this fetches the file as a
   * blob and triggers a save via a throwaway object URL.
   */
  async download(path, filename) {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new ApiError(`Download failed (${res.status})`, res.status, null);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
