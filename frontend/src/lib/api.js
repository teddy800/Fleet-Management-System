const BASE_URL = "";  // Empty = use Vite proxy (same origin, no CORS)

// Odoo 19 type='json' routes require JSON-RPC envelope even for GET requests
// We wrap all calls in the jsonrpc envelope and unwrap the result transparently.
async function request(path, options = {}) {
  let res;

  // Always use POST with JSON-RPC envelope for Odoo type='json' routes
  const isJsonRpc = !options._raw;
  const method = options.method || "POST";
  const body = options.body || JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} });

  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: isJsonRpc ? "POST" : method,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
      body: isJsonRpc ? body : options.body,
    });
  } catch (_networkErr) {
    throw new Error("Network error. Check your connection.");
  }

  // Check Content-Type BEFORE calling res.json()
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (!window.location.pathname.includes("/login")) {
      try {
        const { useUserStore } = await import("@/store/useUserStore");
        useUserStore.getState().logout();
      } catch (_) { /* ignore */ }
      window.location.href = "/login";
    }
    throw new Error("Session expired or backend returned HTML. Please log in again.");
  }

  const raw = await res.json();

  // Odoo 19 jsonrpc envelope: {"jsonrpc":"2.0","id":null,"result":{...}}
  const data = (raw && typeof raw === "object" && "result" in raw) ? raw.result : raw;

  // Odoo JSON-RPC error envelope — only redirect on code 100 (session expired)
  if (raw?.error) {
    const errCode = raw.error?.code;
    const errMsg = raw.error?.message || raw.error?.data?.message || "Request failed";
    if (errCode === 100) {
      try {
        const { useUserStore } = await import("@/store/useUserStore");
        useUserStore.getState().logout();
      } catch (_) { /* ignore */ }
      window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }
    throw new Error(errMsg);
  }

  if (data?.error?.code === 100) {
    try {
      const { useUserStore } = await import("@/store/useUserStore");
      useUserStore.getState().logout();
    } catch (_) { /* ignore */ }
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) throw new Error(data?.error?.message || data?.error || "Request failed");
  if (data?.success === false && data?.error) throw new Error(data.error);
  return data;
}

// --- Auth ---
export const authApi = {
  login: (username, password) =>
    request("/api/mobile/auth/login", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        id: 1,
        params: { username, password },
      }),
    }),
  logout: () =>
    request("/web/session/destroy", { method: "POST", body: JSON.stringify({}) }),
};

// --- Trip Requests ---
export const tripApi = {
  list: () => request("/api/fleet/trip-requests"),
  listMine: () => request("/api/mobile/user/trip-requests"),
  create: (payload) =>
    request("/api/fleet/trip-requests", { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { action: "create", ...payload } }) }),
  approve: (id) =>
    request(`/api/fleet/trip-requests/${id}/approve`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }) }),
  reject: (id, reason) =>
    request(`/api/fleet/trip-requests/${id}/reject`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { reason } }) }),
  assign: (id, vehicleId, driverId) =>
    request(`/api/fleet/trip-requests/${id}/assign`, {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { vehicle_id: vehicleId, driver_id: driverId } }),
    }),
  cancel: (id) =>
    request(`/api/fleet/trip-requests/${id}/cancel`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }) }),
  updatePickup: (id, pickupLocation, note = "") =>
    request(`/api/fleet/trip-requests/${id}/update-pickup`, {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { pickup_location: pickupLocation, note } }),
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
  update: (id, payload) =>
    request(`/api/fleet/drivers/${id}`, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: payload }) }),
};

// --- Available resources for time window (FR-2.2) ---
export const resourceApi = {
  available: (startDatetime, endDatetime, vehicleCategory) =>
    request("/api/fleet/available-resources", {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { start_datetime: startDatetime, end_datetime: endDatetime, vehicle_category: vehicleCategory } }),
    }),
};

// --- User management (FR-5.1) ---
export const userMgmtApi = {
  list: () => request("/api/fleet/users"),
  setRole: (userId, role) =>
    request(`/api/fleet/users/${userId}/set-role`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { role } }) }),
};

// --- Driver mobile (for Driver role) ---
export const driverMobileApi = {
  assignments: () => request("/api/mobile/driver/assignments"),
  startTrip: (assignmentId) =>
    request(`/api/mobile/trip/${assignmentId}/start`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }) }),
  completeTrip: (assignmentId, payload) =>
    request(`/api/mobile/trip/${assignmentId}/complete`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: payload }) }),
  updateLocation: (assignmentId, latitude, longitude, speed = 0, heading = 0, accuracy = 0) =>
    request(`/api/mobile/trip/${assignmentId}/update-location`, {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { latitude, longitude, speed, heading, accuracy } }),
    }),
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

// --- Alerts ---
export const alertsApi = {
  list: () => request("/api/fleet/alerts"),
  acknowledge: (id) =>
    request(`/api/fleet/alerts/${id}/acknowledge`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }) }),
};

// --- Analytics / Dashboard ---
export const analyticsApi = {
  kpis: () => request("/api/fleet/analytics/kpis"),
  dashboard: () => request("/api/fleet/dashboard"),
};
