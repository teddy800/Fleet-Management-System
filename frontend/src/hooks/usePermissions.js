import { useUserStore } from "@/store/useUserStore";
import {
  hasPermission,
  canAccessRoute,
  getMenuForRole,
  ROLE_META,
  isOperationsRole,
  isFieldRole,
  isAdminOnlyRole,
} from "@/config/rbac";

export function usePermissions() {
  const user = useUserStore((s) => s.user);
  const role = user?.role || "Staff";

  return {
    role,
    user,
    meta: ROLE_META[role] || ROLE_META.Staff,
    can: (permission) => hasPermission(role, permission),
    canAccess: (pathname) => canAccessRoute(role, pathname),
    menuItems: getMenuForRole(role),
    isOperations: isOperationsRole(role),
    isField: isFieldRole(role),
    isAdmin: isAdminOnlyRole(role),
    isDispatcher: role === "Dispatcher",
    isDriver: role === "Driver",
    isMechanic: role === "Mechanic",
    isStaff: role === "Staff",
  };
}
