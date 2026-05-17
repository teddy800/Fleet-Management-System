/**
 * MESSOB Fleet — single source of truth for role-based access (NFR-3.2 / BR-1).
 * Aligns with RBAC_QUICK_REFERENCE.md
 */

export const ROLES = ["Admin", "Dispatcher", "Staff", "Driver", "Mechanic"];

export const ROLE_META = {
  Admin: {
    label: "Fleet Manager",
    color: "text-amber-300 bg-amber-400/20 border-amber-400/30",
    dot: "bg-amber-400",
    headerBg: "bg-amber-500",
    description: "Full system access, analytics, and administration",
  },
  Dispatcher: {
    label: "Fleet Dispatcher",
    color: "text-blue-300 bg-blue-400/20 border-blue-400/30",
    dot: "bg-blue-400",
    headerBg: "bg-blue-600",
    description: "Approve trips, assign fleet, and monitor operations",
  },
  Staff: {
    label: "Staff User",
    color: "text-green-300 bg-green-400/20 border-green-400/30",
    dot: "bg-green-400",
    headerBg: "bg-green-600",
    description: "Request vehicles and track your own trips",
  },
  Driver: {
    label: "Driver",
    color: "text-purple-300 bg-purple-400/20 border-purple-400/30",
    dot: "bg-purple-500",
    headerBg: "bg-purple-600",
    description: "Run assigned trips, update location, and log fuel",
  },
  Mechanic: {
    label: "Mechanic",
    color: "text-rose-300 bg-rose-400/20 border-rose-400/30",
    dot: "bg-rose-500",
    headerBg: "bg-rose-600",
    description: "Maintenance logs, fuel records, and service schedules",
  },
};

/** Route path → roles allowed (exact match). */
export const ROUTE_ACCESS = {
  "/dashboard": ROLES,
  "/requests/new": ROLES,
  "/my-requests": ROLES,
  "/profile": ROLES,
  "/driver/assignments": ["Admin", "Driver"],
  "/dispatch/approvals": ["Admin", "Dispatcher"],
  "/dispatch/calendar": ["Admin", "Dispatcher"],
  "/fleet": ["Admin", "Dispatcher", "Mechanic"],
  "/tracking": ["Admin", "Dispatcher", "Driver", "Staff"],
  "/drivers": ["Admin", "Dispatcher"],
  "/fuel-log": ["Admin", "Dispatcher", "Driver", "Mechanic"],
  "/maintenance": ["Admin", "Dispatcher", "Mechanic", "Staff", "Driver"],
  "/alerts": ["Admin", "Dispatcher", "Mechanic"],
  "/analytics": ["Admin"],
  "/inventory": ["Admin"],
  "/hr-sync": ["Admin"],
  "/users": ["Admin"],
};

/** Fine-grained feature flags for UI controls (buttons, forms). */
export const PERMISSIONS = {
  "trip.create": ["Admin", "Dispatcher", "Staff", "Driver", "Mechanic"],
  "trip.viewOwn": ROLES,
  "trip.viewAll": ["Admin", "Dispatcher"],
  "trip.approve": ["Admin", "Dispatcher"],
  "trip.assign": ["Admin", "Dispatcher"],
  "fleet.viewAll": ["Admin", "Dispatcher", "Mechanic"],
  "fleet.manage": ["Admin", "Dispatcher"],
  "drivers.manage": ["Admin", "Dispatcher"],
  "gps.viewAll": ["Admin", "Dispatcher"],
  "gps.viewOwn": ["Admin", "Dispatcher", "Driver", "Staff"],
  "gps.updateLocation": ["Admin", "Dispatcher", "Driver"],
  "fuel.view": ["Admin", "Dispatcher", "Driver", "Mechanic", "Staff"],
  "fuel.create": ["Admin", "Dispatcher", "Driver", "Mechanic"],
  "maintenance.view": ["Admin", "Dispatcher", "Mechanic", "Staff", "Driver"],
  "maintenance.create": ["Admin", "Mechanic"],
  "maintenance.schedules": ["Admin", "Dispatcher", "Mechanic"],
  "alerts.view": ["Admin", "Dispatcher", "Mechanic"],
  "alerts.acknowledge": ["Admin", "Dispatcher"],
  "analytics.full": ["Admin"],
  "analytics.dashboard": ["Admin", "Dispatcher"],
  "admin.inventory": ["Admin"],
  "admin.hrSync": ["Admin"],
  "admin.users": ["Admin"],
  "driver.assignments": ["Admin", "Driver"],
  "driver.startTrip": ["Admin", "Driver"],
  "driver.completeTrip": ["Admin", "Driver"],
};

export const MENU_ITEMS = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: "LayoutDashboard",
    roles: ROLES,
    section: "overview",
  },
  {
    name: "New Request",
    path: "/requests/new",
    icon: "ClipboardList",
    roles: ROLES,
    section: "requests",
  },
  {
    name: "My Requests",
    path: "/my-requests",
    icon: "ClipboardList",
    roles: ROLES,
    section: "requests",
  },
  {
    name: "My Assignments",
    path: "/driver/assignments",
    icon: "Truck",
    roles: ["Admin", "Driver"],
    section: "driver",
    badge: "Driver",
  },
  {
    name: "Approval Queue",
    path: "/dispatch/approvals",
    icon: "CheckSquare",
    roles: ["Admin", "Dispatcher"],
    section: "dispatch",
    badge: "Dispatch",
  },
  {
    name: "Fleet Calendar",
    path: "/dispatch/calendar",
    icon: "CalendarDays",
    roles: ["Admin", "Dispatcher"],
    section: "dispatch",
  },
  {
    name: "Manage Fleet",
    path: "/fleet",
    icon: "Car",
    roles: ["Admin", "Dispatcher", "Mechanic"],
    section: "fleet",
  },
  {
    name: "Drivers",
    path: "/drivers",
    icon: "Users",
    roles: ["Admin", "Dispatcher"],
    section: "fleet",
  },
  {
    name: "GPS Tracking",
    path: "/tracking",
    icon: "Navigation",
    roles: ["Admin", "Dispatcher", "Driver", "Staff"],
    section: "tracking",
  },
  {
    name: "Fleet Alerts",
    path: "/alerts",
    icon: "Bell",
    roles: ["Admin", "Dispatcher", "Mechanic"],
    section: "tracking",
  },
  {
    name: "Maintenance",
    path: "/maintenance",
    icon: "Wrench",
    roles: ["Admin", "Dispatcher", "Mechanic", "Staff", "Driver"],
    section: "service",
  },
  {
    name: "Fuel Logs",
    path: "/fuel-log",
    icon: "Fuel",
    roles: ["Admin", "Dispatcher", "Driver", "Mechanic"],
    section: "service",
  },
  {
    name: "Analytics",
    path: "/analytics",
    icon: "BarChart3",
    roles: ["Admin"],
    section: "admin",
    badge: "Admin",
  },
  {
    name: "Parts & Inventory",
    path: "/inventory",
    icon: "Package",
    roles: ["Admin"],
    section: "admin",
  },
  {
    name: "HR Sync",
    path: "/hr-sync",
    icon: "RefreshCw",
    roles: ["Admin"],
    section: "admin",
  },
  {
    name: "User Management",
    path: "/users",
    icon: "ShieldCheck",
    roles: ["Admin"],
    section: "admin",
  },
];

export const SECTION_LABELS = {
  overview: "Overview",
  requests: "Trip Requests",
  driver: "Driver Operations",
  dispatch: "Dispatch Center",
  fleet: "Fleet Management",
  tracking: "Tracking & Alerts",
  service: "Maintenance & Fuel",
  admin: "Administration",
};

export function hasPermission(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function canAccessRoute(role, pathname) {
  const allowed = ROUTE_ACCESS[pathname];
  if (!allowed) return true;
  return allowed.includes(role);
}

export function getMenuForRole(role) {
  return MENU_ITEMS.filter((item) => item.roles.includes(role));
}

export function getDefaultDashboardPath(role) {
  return "/dashboard";
}

/** Role category helpers for layout / dashboard variants */
export function isOperationsRole(role) {
  return role === "Admin" || role === "Dispatcher";
}

export function isFieldRole(role) {
  return role === "Staff" || role === "Driver" || role === "Mechanic";
}

export function isAdminOnlyRole(role) {
  return role === "Admin";
}
