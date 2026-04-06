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

// --- Auth ---
export const authApi = {
  login: (username, password) =>
    request("/api/mobile/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () =>
    request("/web/session/destroy", { method: "POST", body: JSON.stringify({}) }),
};

// --- Trip Requests ---
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
  cancel: (id) =>
    request(`/api/fleet/trip-requests/${id}/cancel`, { method: "POST", body: JSON.stringify({}) }),
  updatePickup: (id, pickupLocation, note = "") =>
    request(`/api/fleet/trip-requests/${id}/update-pickup`, {
      method: "POST", body: JSON.stringify({ pickup_location: pickupLocation, note }),
    }),
  coPassengers: (id) =>
    request(`/api/fleet/trip-requests/${id}/co-passengers`),
};

// --- Fleet Vehicles ---
export const fleetApi = {
  list: () => request("/api/fleet/vehicles"),
  getLocation: (id) => request(`/api/fleet/vehicles/${id}/location`),
};

// --- Drivers ---
export const driverApi = {
  list: () => request("/api/fleet/drivers"),
};

// --- Fuel Logs ---
export const fuelApi = {
  list: () => request("/api/fleet/fuel-logs"),
};

// --- Maintenance ---
export const maintenanceApi = {
  list: () => request("/api/fleet/maintenance-logs"),
  schedules: () => request("/api/fleet/maintenance-schedules"),
  predictions: () => request("/api/fleet/maintenance/predictions"),
};

// --- Analytics / Dashboard ---
export const analyticsApi = {
  kpis: () => request("/api/fleet/analytics/kpis"),
  dashboard: () => request("/api/fleet/dashboard"),
};
