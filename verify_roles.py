"""Verify each user gets the correct role from the mobile login endpoint."""
import json, urllib.request

ODOO_URL = "http://localhost:8069"
DB = "messob_db"

TEST_ACCOUNTS = [
    ("admin",                       "admin",          "Admin"),
    ("tigist.haile@mesob.com",      "Dispatcher@123", "Dispatcher"),
    ("rahel.mekonnen@mesob.com",    "Dispatcher@123", "Dispatcher"),
    ("dawit.bekele@mesob.com",      "Staff@123",      "Staff"),
    ("abebe.kebede@mesob.com",      "Driver@123",     "Driver"),
    ("biruk.tadesse@mesob.com",     "Mechanic@123",   "Mechanic"),
]

print("\n" + "="*80)
print("  MESSOB-FMS Role Verification (via /api/mobile/auth/login)")
print("="*80)
print(f"  {'EXPECTED':<12} {'USERNAME':<38} {'ROLES RETURNED'}")
print("-"*80)

for login, pw, expected_role in TEST_ACCOUNTS:
    try:
        body = json.dumps({
            "jsonrpc": "2.0", "method": "call", "id": 1,
            "params": {"username": login, "password": pw}
        }).encode()
        req = urllib.request.Request(
            f"{ODOO_URL}/api/mobile/auth/login",
            data=body, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            raw = json.loads(r.read())
            result = raw.get("result", {})
            if result.get("success"):
                roles = result.get("user", {}).get("roles", [])
                name  = result.get("user", {}).get("name", "?")
                # Determine frontend role
                if "fleet_manager" in roles:
                    fe_role = "Admin"
                elif "fleet_dispatcher" in roles:
                    fe_role = "Dispatcher"
                elif "fleet_user" in roles:
                    fe_role = "Staff"
                elif "driver" in roles:
                    fe_role = "Driver"
                elif not roles:
                    fe_role = "Admin (no groups)"
                else:
                    fe_role = "Unknown"
                match = "✅" if fe_role.startswith(expected_role) or (expected_role == "Admin" and "Admin" in fe_role) else "⚠️ "
                print(f"  {match} {expected_role:<12} {login:<38} roles={roles} → {fe_role}")
            else:
                print(f"  ❌ {expected_role:<12} {login:<38} LOGIN FAILED: {result.get('error')}")
    except Exception as e:
        print(f"  ❌ {expected_role:<12} {login}: {e}")

print("="*80 + "\n")
