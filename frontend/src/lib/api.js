const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8069";

/**
 * Core fetch wrapper — attaches session cookie automatically
 */
async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include", // sends Odoo session_id cookie
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || data.error || "Request failed");
  }

  // Odoo sometimes returns { success: false, error: "..." } in a 200
  if (data.success === false) {
    throw new Error(data.error || "Unknown error");
  }

  return data;
}

// --- Auth ---
export const authApi = {
  login: (email, password) =>
    request("/api/mobile/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request("/web/session/destroy", { method: "POST", body: JSON.stringify({}) }),
};

// --- Trip Requests ---
export const tripApi = {
  list: () => request("/api/fleet/trip-requests"),
  create: (payload) =>
    request("/api/fleet/trip-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  approve: (id) =>
    request(`/api/fleet/trip-requests/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
  reject: (id, reason) =>
    request(`/api/fleet/trip-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  assign: (id, vehicleId, driverId) =>
    request(`/api/fleet/trip-requests/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ vehicle_id: vehicleId, driver_id: driverId }),
    }),
};

// --- Fleet Vehicles ---
export const fleetApi = {
  list: () => request("/api/fleet/vehicles"),
  getLocation: (id) => request(`/api/fleet/vehicles/${id}/location`),
};

// --- Analytics ---
export const analyticsApi = {
  kpis: () => request("/api/fleet/analytics/kpis"),
  dashboard: () => request("/api/fleet/dashboard"),
};

// --- Maintenance ---
export const maintenanceApi = {
  predictions: () => request("/api/fleet/maintenance/predictions"),
};
