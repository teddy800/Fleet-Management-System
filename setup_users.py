"""
MESSOB Fleet Management System — User Setup Script
Creates all role-based users in Odoo with correct passwords and groups.

Run from the workspace root:
    python setup_users.py

Requirements: Odoo must be running on http://localhost:8069
"""
import json
import urllib.request
import urllib.error
import sys

ODOO_URL = "http://localhost:8069"
DB = "messob_db"
ADMIN_USER = "admin"
ADMIN_PASS = "admin"

# ─── Users to create ──────────────────────────────────────────────────────────
USERS = [
    # Dispatchers
    {
        "name": "Tigist Haile",
        "login": "tigist.haile@mesob.com",
        "email": "tigist.haile@mesob.com",
        "password": "Dispatcher@123",
        "group": "fleet_dispatcher",
        "is_driver": False,
        "external_hr_id": "EMP-STF-001",
    },
    {
        "name": "Rahel Mekonnen",
        "login": "rahel.mekonnen@mesob.com",
        "email": "rahel.mekonnen@mesob.com",
        "password": "Dispatcher@123",
        "group": "fleet_dispatcher",
        "is_driver": False,
        "external_hr_id": "EMP-STF-003",
    },
    # Staff
    {
        "name": "Dawit Bekele",
        "login": "dawit.bekele@mesob.com",
        "email": "dawit.bekele@mesob.com",
        "password": "Staff@123",
        "group": "fleet_user",
        "is_driver": False,
        "external_hr_id": "EMP-STF-002",
    },
    {
        "name": "Kebede Worku",
        "login": "kebede.worku@mesob.com",
        "email": "kebede.worku@mesob.com",
        "password": "Staff@123",
        "group": "fleet_user",
        "is_driver": False,
        "external_hr_id": "EMP-STF-004",
    },
    # Drivers
    {
        "name": "Abebe Kebede",
        "login": "abebe.kebede@mesob.com",
        "email": "abebe.kebede@mesob.com",
        "password": "Driver@123",
        "group": "fleet_user",
        "is_driver": True,
        "external_hr_id": "EMP-DRV-001",
        "license_no": "DL-ETH-001",
        "license_expiry": "2027-12-31",
    },
    {
        "name": "Sara Tesfaye",
        "login": "sara.tesfaye@mesob.com",
        "email": "sara.tesfaye@mesob.com",
        "password": "Driver@123",
        "group": "fleet_user",
        "is_driver": True,
        "external_hr_id": "EMP-DRV-002",
        "license_no": "DL-ETH-002",
        "license_expiry": "2026-06-30",
    },
    {
        "name": "Yonas Girma",
        "login": "yonas.girma@mesob.com",
        "email": "yonas.girma@mesob.com",
        "password": "Driver@123",
        "group": "fleet_user",
        "is_driver": True,
        "external_hr_id": "EMP-DRV-003",
        "license_no": "DL-ETH-003",
        "license_expiry": "2028-03-15",
    },
    {
        "name": "Mekdes Alemu",
        "login": "mekdes.alemu@mesob.com",
        "email": "mekdes.alemu@mesob.com",
        "password": "Driver@123",
        "group": "fleet_user",
        "is_driver": True,
        "external_hr_id": "EMP-DRV-004",
        "license_no": "DL-ETH-004",
        "license_expiry": "2027-09-20",
    },
    {
        "name": "Hana Worku",
        "login": "hana.worku@mesob.com",
        "email": "hana.worku@mesob.com",
        "password": "Driver@123",
        "group": "fleet_user",
        "is_driver": True,
        "external_hr_id": "EMP-DRV-006",
        "license_no": "DL-ETH-006",
        "license_expiry": "2029-01-10",
    },
    {
        "name": "Tesfaye Mulugeta",
        "login": "tesfaye.mulugeta@mesob.com",
        "email": "tesfaye.mulugeta@mesob.com",
        "password": "Driver@123",
        "group": "fleet_user",
        "is_driver": True,
        "external_hr_id": "EMP-DRV-007",
        "license_no": "DL-ETH-007",
        "license_expiry": "2028-07-22",
    },
    {
        "name": "Liya Solomon",
        "login": "liya.solomon@mesob.com",
        "email": "liya.solomon@mesob.com",
        "password": "Driver@123",
        "group": "fleet_user",
        "is_driver": True,
        "external_hr_id": "EMP-DRV-008",
        "license_no": "DL-ETH-008",
        "license_expiry": "2027-04-05",
    },
    # Mechanic
    {
        "name": "Biruk Tadesse",
        "login": "biruk.tadesse@mesob.com",
        "email": "biruk.tadesse@mesob.com",
        "password": "Mechanic@123",
        "group": "fleet_user",
        "is_driver": False,
        "external_hr_id": "EMP-DRV-005",
    },
]

# ─── JSON-RPC helper ──────────────────────────────────────────────────────────
_session_id = None

def rpc(endpoint, params, use_session=True):
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": "call",
        "id": 1,
        "params": params,
    }).encode()
    headers = {"Content-Type": "application/json"}
    if use_session and _session_id:
        headers["Cookie"] = f"session_id={_session_id}"
    req = urllib.request.Request(f"{ODOO_URL}{endpoint}", data=payload, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = json.loads(resp.read())
            if raw.get("error"):
                raise RuntimeError(raw["error"].get("data", {}).get("message") or str(raw["error"]))
            return raw.get("result")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Cannot reach Odoo at {ODOO_URL}: {e}")


def authenticate():
    global _session_id
    result = rpc("/web/session/authenticate", {
        "db": DB, "login": ADMIN_USER, "password": ADMIN_PASS,
    }, use_session=False)
    if not result or not result.get("uid"):
        raise RuntimeError("Admin authentication failed. Check admin credentials.")
    # Grab session cookie from a fresh call
    payload = json.dumps({"jsonrpc": "2.0", "method": "call", "id": 1,
                          "params": {"db": DB, "login": ADMIN_USER, "password": ADMIN_PASS}}).encode()
    req = urllib.request.Request(f"{ODOO_URL}/web/session/authenticate",
                                  data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        _session_id = None
        for header, value in resp.headers.items():
            if header.lower() == "set-cookie" and "session_id=" in value:
                _session_id = value.split("session_id=")[1].split(";")[0]
                break
    print(f"  ✅ Authenticated as admin (uid={result['uid']})")
    return result["uid"]


def get_group_id(xml_id):
    result = rpc("/web/dataset/call_kw", {
        "model": "ir.model.data",
        "method": "search_read",
        "args": [[["name", "=", xml_id.split(".")[-1]],
                  ["module", "=", xml_id.split(".")[0]]]],
        "kwargs": {"fields": ["res_id"], "limit": 1},
    })
    if result:
        return result[0]["res_id"]
    # Fallback: search by full name
    result2 = rpc("/web/dataset/call_kw", {
        "model": "res.groups",
        "method": "search_read",
        "args": [[["full_name", "ilike", xml_id.split(".")[-1].replace("group_fleet_", "Fleet ")]]],
        "kwargs": {"fields": ["id", "full_name"], "limit": 5},
    })
    if result2:
        return result2[0]["id"]
    return None


def get_base_user_group():
    # Search by xml_id base.group_user (Internal User)
    result = rpc("/web/dataset/call_kw", {
        "model": "ir.model.data",
        "method": "search_read",
        "args": [[["module", "=", "base"], ["name", "=", "group_user"]]],
        "kwargs": {"fields": ["res_id"], "limit": 1},
    })
    if result:
        return result[0]["res_id"]
    # Fallback: search by name
    result2 = rpc("/web/dataset/call_kw", {
        "model": "res.groups",
        "method": "search_read",
        "args": [[["name", "=", "Internal User"]]],
        "kwargs": {"fields": ["id", "full_name"], "limit": 3},
    })
    if result2:
        return result2[0]["id"]
    return None


def user_exists(login):
    result = rpc("/web/dataset/call_kw", {
        "model": "res.users",
        "method": "search_read",
        "args": [[["login", "=", login]]],
        "kwargs": {"fields": ["id", "name"], "limit": 1},
    })
    return result[0] if result else None


def create_or_update_user(u, group_ids, base_group_id):
    existing = user_exists(u["login"])

    if existing:
        uid = existing["id"]
        # Update password first
        rpc("/web/dataset/call_kw", {
            "model": "res.users",
            "method": "write",
            "args": [[uid], {"password": u["password"]}],
            "kwargs": {},
        })
        # Assign groups via write with Many2many command
        all_groups = list(set(group_ids + ([base_group_id] if base_group_id else [])))
        try:
            rpc("/web/dataset/call_kw", {
                "model": "res.users",
                "method": "write",
                "args": [[uid], {"groups_id": [(4, gid) for gid in all_groups]}],
                "kwargs": {},
            })
        except Exception:
            # Odoo 19 may reject groups_id on write — use action_grant_group instead
            for gid in group_ids:
                try:
                    rpc("/web/dataset/call_kw", {
                        "model": "res.groups",
                        "method": "write",
                        "args": [[gid], {"users": [(4, uid)]}],
                        "kwargs": {},
                    })
                except Exception:
                    pass
        print(f"  🔄 Updated: {u['name']} ({u['login']}) → {u['group']}")
        return uid
    else:
        # Create user without groups first (Odoo 19 compatible)
        vals = {
            "name": u["name"],
            "login": u["login"],
            "email": u["email"],
            "password": u["password"],
        }
        uid = rpc("/web/dataset/call_kw", {
            "model": "res.users",
            "method": "create",
            "args": [vals],
            "kwargs": {},
        })
        # Now assign groups by adding user to each group
        all_groups = list(set(group_ids + ([base_group_id] if base_group_id else [])))
        for gid in all_groups:
            try:
                rpc("/web/dataset/call_kw", {
                    "model": "res.groups",
                    "method": "write",
                    "args": [[gid], {"users": [(4, uid)]}],
                    "kwargs": {},
                })
            except Exception as ge:
                print(f"    ⚠️  Could not assign group {gid}: {ge}")
        print(f"  ✅ Created: {u['name']} ({u['login']}) → {u['group']}")
        return uid


def ensure_employee(u, uid):
    """Create or update hr.employee linked to the user."""
    existing = rpc("/web/dataset/call_kw", {
        "model": "hr.employee",
        "method": "search_read",
        "args": [[["user_id", "=", uid]]],
        "kwargs": {"fields": ["id"], "limit": 1},
    })

    vals = {
        "name": u["name"],
        "work_email": u["email"],
        "user_id": uid,
        "is_driver": u.get("is_driver", False),
        "external_hr_id": u.get("external_hr_id", ""),
        "synced_from_hr": True,
    }
    if u.get("license_no"):
        vals["driver_license_number"] = u["license_no"]
    if u.get("license_expiry"):
        vals["license_expiry_date"] = u["license_expiry"]

    if existing:
        rpc("/web/dataset/call_kw", {
            "model": "hr.employee",
            "method": "write",
            "args": [[existing[0]["id"]], vals],
            "kwargs": {},
        })
    else:
        rpc("/web/dataset/call_kw", {
            "model": "hr.employee",
            "method": "create",
            "args": [vals],
            "kwargs": {},
        })


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("\n" + "=" * 60)
    print("  MESSOB-FMS User Setup")
    print("=" * 60)

    print("\n[1/4] Connecting to Odoo...")
    try:
        authenticate()
    except RuntimeError as e:
        print(f"\n  ❌ ERROR: {e}")
        print("  Make sure Odoo is running: http://localhost:8069")
        sys.exit(1)

    print("\n[2/4] Resolving group IDs...")
    group_map = {}
    for gname in ["fleet_user", "fleet_dispatcher", "fleet_manager"]:
        xml_id = f"mesob_fleet_customizations.group_{gname}"
        gid = get_group_id(xml_id)
        if gid:
            group_map[gname] = gid
            print(f"  ✅ {gname} → id={gid}")
        else:
            print(f"  ⚠️  {gname} not found (module may not be installed)")

    base_group = get_base_user_group()
    if base_group:
        print(f"  ✅ base Internal User group → id={base_group}")
    else:
        print("  ⚠️  Could not find Internal User group")

    # fleet_dispatcher inherits fleet_user, fleet_manager inherits both
    # So we only need to assign the highest group
    def resolve_groups(group_name):
        gid = group_map.get(group_name)
        return [gid] if gid else []

    print("\n[3/4] Creating / updating users...")
    results = {"created": 0, "updated": 0, "failed": 0}

    for u in USERS:
        try:
            gids = resolve_groups(u["group"])
            uid = create_or_update_user(u, gids, base_group)
            ensure_employee(u, uid)
            results["created"] += 1
        except Exception as e:
            print(f"  ❌ Failed {u['login']}: {e}")
            results["failed"] += 1

    print("\n[4/4] Summary")
    print("=" * 60)
    print(f"  ✅ Processed : {results['created']}")
    print(f"  ❌ Failed    : {results['failed']}")
    print()
    print("  CREDENTIALS READY:")
    print()
    print("  ┌─────────────────────────────────────────────────────┐")
    print("  │  ROLE          USERNAME                  PASSWORD   │")
    print("  ├─────────────────────────────────────────────────────┤")
    print("  │  Admin         admin                     admin      │")
    print("  │  Dispatcher    tigist.haile@mesob.com    Dispatcher@123 │")
    print("  │  Dispatcher    rahel.mekonnen@mesob.com  Dispatcher@123 │")
    print("  │  Staff         dawit.bekele@mesob.com    Staff@123  │")
    print("  │  Staff         kebede.worku@mesob.com    Staff@123  │")
    print("  │  Driver        abebe.kebede@mesob.com    Driver@123 │")
    print("  │  Driver        sara.tesfaye@mesob.com    Driver@123 │")
    print("  │  Driver        yonas.girma@mesob.com     Driver@123 │")
    print("  │  Driver        mekdes.alemu@mesob.com    Driver@123 │")
    print("  │  Driver        hana.worku@mesob.com      Driver@123 │")
    print("  │  Driver        tesfaye.mulugeta@mesob.com Driver@123│")
    print("  │  Driver        liya.solomon@mesob.com    Driver@123 │")
    print("  │  Mechanic      biruk.tadesse@mesob.com   Mechanic@123│")
    print("  └─────────────────────────────────────────────────────┘")
    print()
    print("  Open: http://localhost:3000")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
