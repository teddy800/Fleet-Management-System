const BASE_URL = "";

// ─── In-memory cache ──────────────────────────────────────────────────────────
const _cache = new Map();
const _inflight = new Map();

const CACHE_TTL = {
  default:   60_000,   // 60s
  dashboard: 55_000,   // 55s — slightly under the 60s refresh interval so data is always fresh
  vehicles:  30_000,   // 30s — GPS updates
  alerts:    20_000,   // 20s — alerts
  drivers:   60_000,   // 60s — drivers change rarely
  trips:     15_000,   // 15s — trips change more often
};

function getCacheTTL(path) {
  if (path.includes("/dashboard")) return CACHE_TTL.dashboard;
  if (path.includes("/vehicles"))  return CACHE_TTL.vehicles;
  if (path.includes("/alerts"))    return CACHE_TTL.alerts;
  if (path.includes("/drivers"))   return CACHE_TTL.drivers;
  if (path.includes("/trip-requests")) return CACHE_TTL.trips;
  return CACHE_TTL.default;
}

// Invalidate cache entries matching a prefix (call after mutations)
export function invalidateCache(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

// Clear entire cache — used in tests to bypass caching
export function clearCache() {
  _cache.clear();
  _inflight.clear();
}

// ─── Core fetch ───────────────────────────────────────────────────────────────
async function request(path, options = {}) {
  const isJsonRpc = !options._raw;
  const body = options.body || JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} });

  // Only cache read-only (no custom body = list/get calls)
  const isCacheable = isJsonRpc && !options.body;
  const cacheKey = path;

  if (isCacheable) {
    const cached = _cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < getCacheTTL(path)) {
      return cached.data;
    }
    // Deduplicate: if same request is already in-flight, wait for it
    if (_inflight.has(cacheKey)) {
      return _inflight.get(cacheKey);
    }
  }

  const fetchPromise = _doFetch(path, body, isJsonRpc, options).then(data => {
    if (isCacheable) {
      _cache.set(cacheKey, { data, ts: Date.now() });
      _inflight.delete(cacheKey);
    }
    return data;
  }).catch(err => {
    if (isCacheable) _inflight.delete(cacheKey);
    throw err;
  });

  if (isCacheable) _inflight.set(cacheKey, fetchPromise);
  return fetchPromise;
}

async function _doFetch(path, body, isJsonRpc, options) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
      body: isJsonRpc ? body : options.body,
    });
  } catch (_) {
    throw new Error("Network error. Check your connection.");
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (!(window.location?.pathname || "").includes("/login")) {
      try {
        const { useUserStore } = await import("@/store/useUserStore");
        useUserStore.getState().logout();
      } catch (_) { /* ignore */ }
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  const raw = await res.json();
  const data = (raw && typeof raw === "object" && "result" in raw) ? raw.result : raw;

  if (raw?.error) {
    const errCode = raw.error?.code;
    const errMsg = raw.error?.message || raw.error?.data?.message || "Request failed";
    if (errCode === 100) {
      try { const { useUserStore } = await import("@/store/useUserStore"); useUserStore.getState().logout(); } catch (_) {}
      window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }
    throw new Error(errMsg);
  }

  if (data?.error?.code === 100) {
    try { const { useUserStore } = await import("@/store/useUserStore"); useUserStore.getState().logout(); } catch (_) {}
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  // NFR-3.2: Surface permission errors with a clear, actionable message
  if (res.status === 403 || data?.error === "Insufficient permissions" ||
      (typeof data?.error === "string" && data.error.toLowerCase().includes("permission"))) {
    throw new Error("You do not have permission to perform this action.");
  }

  if (!res.ok) throw new Error(data?.error?.message || data?.error || "Request failed");
  if (data?.success === false && data?.error) {
    const errStr = data.error;
    // Translate common backend errors to user-friendly messages
    if (errStr.toLowerCase().includes("permission") || errStr.toLowerCase().includes("access")) {
      throw new Error("You do not have permission to perform this action.");
    }
    if (errStr.toLowerCase().includes("cannot be cancelled") || errStr.toLowerCase().includes("can't cancel")) {
      throw new Error("This request cannot be cancelled in its current state.");
    }
    throw new Error(errStr);
  }
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username, password) =>
    request("/api/mobile/auth/login", {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { username, password } }),
    }),
  logout: () => request("/web/session/destroy", { body: JSON.stringify({}) }),
};

// ─── Trip Requests ────────────────────────────────────────────────────────────
export const tripApi = {
  list:    () => request("/api/fleet/trip-requests"),
  listMine:() => request("/api/mobile/user/trip-requests"),
  create:  (payload) => {
    invalidateCache("/api/fleet/trip-requests");
    invalidateCache("/api/mobile/user/trip-requests");
    return request("/api/fleet/trip-requests", {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { action: "create", ...payload } }),
    });
  },
  approve: (id) => {
    invalidateCache("/api/fleet/trip-requests");
    return request(`/api/fleet/trip-requests/${id}/approve`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }) });
  },
  reject:  (id, reason) => {
    invalidateCache("/api/fleet/trip-requests");
    return request(`/api/fleet/trip-requests/${id}/reject`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { reason } }) });
  },
  assign:  (id, vehicleId, driverId) => {
    invalidateCache("/api/fleet/trip-requests");
    invalidateCache("/api/fleet/vehicles");
    return request(`/api/fleet/trip-requests/${id}/assign`, {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { vehicle_id: vehicleId, driver_id: driverId } }),
    });
  },
  cancel:  (id) => {
    invalidateCache("/api/fleet/trip-requests");
    return request(`/api/fleet/trip-requests/${id}/cancel`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }) });
  },
  updatePickup: (id, pickupLocation, note = "") =>
    request(`/api/fleet/trip-requests/${id}/update-pickup`, {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { pickup_location: pickupLocation, note } }),
    }),
  coPassengers: (id) => request(`/api/fleet/trip-requests/${id}/co-passengers`),
};

// ─── Fleet Vehicles ───────────────────────────────────────────────────────────
export const fleetApi = {
  list:        () => request("/api/fleet/vehicles"),
  getLocation: (id) => request(`/api/fleet/vehicles/${id}/location`),
};

// ─── Drivers ──────────────────────────────────────────────────────────────────
export const driverApi = {
  list:   () => request("/api/fleet/drivers"),
  update: (id, payload) => {
    invalidateCache("/api/fleet/drivers");
    return request(`/api/fleet/drivers/${id}`, {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: payload }),
    });
  },
};

// ─── Available resources ──────────────────────────────────────────────────────
export const resourceApi = {
  available: (startDatetime, endDatetime, vehicleCategory) =>
    request("/api/fleet/available-resources", {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { start_datetime: startDatetime, end_datetime: endDatetime, vehicle_category: vehicleCategory } }),
    }),
};

// ─── User management ──────────────────────────────────────────────────────────
export const userMgmtApi = {
  list:    () => request("/api/fleet/users"),
  setRole: (userId, role) => {
    invalidateCache("/api/fleet/users");
    return request(`/api/fleet/users/${userId}/set-role`, {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { role } }),
    });
  },
};

// ─── Driver mobile ────────────────────────────────────────────────────────────
export const driverMobileApi = {
  assignments:    () => request("/api/mobile/driver/assignments"),
  startTrip:      (id) => request(`/api/mobile/trip/${id}/start`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }) }),
  completeTrip:   (id, payload) => request(`/api/mobile/trip/${id}/complete`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: payload }) }),
  updateLocation: (id, latitude, longitude, speed = 0, heading = 0, accuracy = 0) =>
    request(`/api/mobile/trip/${id}/update-location`, {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { latitude, longitude, speed, heading, accuracy } }),
    }),
};

// ─── Fuel Logs ────────────────────────────────────────────────────────────────
export const fuelApi = {
  list: () => request("/api/fleet/fuel-logs"),
  create: (payload) => {
    invalidateCache("/api/fleet/fuel-logs");
    return request("/api/fleet/fuel-logs/create", {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: payload }),
    });
  },
};

// ─── Maintenance ──────────────────────────────────────────────────────────────
export const maintenanceApi = {
  list:        () => request("/api/fleet/maintenance-logs"),
  schedules:   () => request("/api/fleet/maintenance-schedules"),
  predictions: () => request("/api/fleet/maintenance/predictions"),
  create: (payload) => {
    invalidateCache("/api/fleet/maintenance-logs");
    return request("/api/fleet/maintenance-logs/create", {
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: payload }),
    });
  },
};

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: () => request("/api/fleet/alerts"),
  acknowledge: (id) => {
    invalidateCache("/api/fleet/alerts");
    return request(`/api/fleet/alerts/${id}/acknowledge`, { body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }) });
  },
};

// ─── Analytics / Dashboard ────────────────────────────────────────────────────
export const analyticsApi = {
  kpis:      () => request("/api/fleet/analytics/kpis"),
  dashboard: () => request("/api/fleet/dashboard"),
};

// ─── Admin utilities ──────────────────────────────────────────────────────────
export const adminApi = {
  deduplicateDrivers: () => request("/api/fleet/admin/deduplicate-drivers", {
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: {} }),
  }),
};
