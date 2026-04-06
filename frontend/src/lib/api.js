const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8069";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || data.error || "Request failed");
  if (data.success === false) throw new Error(data.error || "Unknown error");
  return data;
}

export const authApi = {
  login: (username, password) =>
    request("/api/mobile/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () =>
    request("/web/session/destroy", { method: "POST", body: JSON.stringify({}) }),
};

export const tripApi = {
  list: () => request("/api/fleet/trip-requests"),
  listMine: () => request("/api/mobile/user/trip-requests"),
  create: (payload) =>
    request("/api/fleet/trip-requests", { method: "POST", body: JSON.stringify(payload) }),
  approve: (id) =>
    request(`/api/fleet/trip-requests/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
  reject: (id, reason) =>
    request(`/api/fleet/trip-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  assign: (id, vehicleId, driverId) =>
    request(`/api/fleet/trip-requests/${id}/assign`, {
      method: "POST", body: JSON.stringify({ vehicle_id: vehicleId, driver_id: driverId }),
    }),
};

export const fleetApi = {
  list: () => request("/api/fleet/vehicles"),
  getLocation: (id) => request(`/api/fleet/vehicles/${id}/location`),
};

export const fuelApi = {
  list: () => request("/api/fleet/fuel-logs"),
};

export const maintenanceApi = {
  list: () => request("/api/fleet/maintenance-logs"),
  predictions: () => request("/api/fleet/maintenance/predictions"),
};

export const analyticsApi = {
  kpis: () => request("/api/fleet/analytics/kpis"),
  dashboard: () => request("/api/fleet/dashboard"),
};
