const BASE_URL = "";  // Empty = use Vite proxy (same origin, no CORS)

// Odoo 19 wraps all type='json' (jsonrpc) responses in {"jsonrpc":"2.0","result":{...}}
// We unwrap that transparently here.
async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
  } catch (_networkErr) {
    throw new Error("Network error. Check your connection.");
  }

  // Check Content-Type BEFORE calling res.json() to avoid "Unexpected token '<'"
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    // Odoo returned HTML — session expired or unauthenticated
    try {
      const { useUserStore } = await import("@/store/useUserStore");
      useUserStore.getState().logout();
    } catch (_) { /* ignore if store not available */ }
    window.location.href = "/login";
    throw new Error("Session expired or backend returned HTML. Please log in again.");
  }

  const raw = await res.json();

  // Odoo 19 jsonrpc envelope: {"jsonrpc":"2.0","id":null,"result":{...}}
  // Unwrap it so the rest of the code sees the inner object directly
  const data = (raw && typeof raw === "object" && "result" in raw) ? raw.result : raw;

  // Odoo JSON-RPC error envelope (top-level error key)
  if (raw?.error) {
    const errCode = raw.error?.code;
    const errMsg = raw.error?.message || raw.error?.data?.message || "Request failed";
    if (errCode === 100 || errMsg.includes("Session Expired") || errMsg.includes("session")) {
      try {
        const { useUserStore } = await import("@/store/useUserStore");
        useUserStore.getState().logout();
      } catch (_) { /* ignore */ }
      window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }
    throw new Error(errMsg);
  }

  // Inner session expiry check
  if (data?.error?.code === 100 || data?.error?.message?.includes("Session Expired")) {
    try {
      const { useUserStore } = await import("@/store/useUserStore");
      useUserStore.getState().logout();
    } catch (_) { /* ignore */ }
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) throw new Error(data?.error?.message || data?.error || "Request failed");
  if (data?.success === false) throw new Error(data?.error || "Unknown error");
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
  update: (id, payload) =>
    request(`/api/fleet/drivers/${id}`, { method: "POST", body: JSON.stringify(payload) }),
};

// --- Available resources for time window (FR-2.2) ---
export const resourceApi = {
  available: (startDatetime, endDatetime, vehicleCategory) =>
    request("/api/fleet/available-resources", {
      method: "POST",
      body: JSON.stringify({ start_datetime: startDatetime, end_datetime: endDatetime, vehicle_category: vehicleCategory }),
    }),
};

// --- User management (FR-5.1) ---
export const userMgmtApi = {
  list: () => request("/api/fleet/users"),
  setRole: (userId, role) =>
    request(`/api/fleet/users/${userId}/set-role`, { method: "POST", body: JSON.stringify({ role }) }),
};

// --- Driver mobile (for Driver role) ---
export const driverMobileApi = {
  assignments: () => request("/api/mobile/driver/assignments"),
  startTrip: (assignmentId) =>
    request(`/api/mobile/trip/${assignmentId}/start`, { method: "POST", body: JSON.stringify({}) }),
  completeTrip: (assignmentId, payload) =>
    request(`/api/mobile/trip/${assignmentId}/complete`, { method: "POST", body: JSON.stringify(payload) }),
  updateLocation: (assignmentId, latitude, longitude, speed = 0, heading = 0, accuracy = 0) =>
    request(`/api/mobile/trip/${assignmentId}/update-location`, {
      method: "POST", body: JSON.stringify({ latitude, longitude, speed, heading, accuracy }),
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
    request(`/api/fleet/alerts/${id}/acknowledge`, { method: "POST", body: JSON.stringify({}) }),
};

// --- Analytics / Dashboard ---
export const analyticsApi = {
  kpis: () => request("/api/fleet/analytics/kpis"),
  dashboard: () => request("/api/fleet/dashboard"),
};
