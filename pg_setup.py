"""
Direct PostgreSQL setup for MESSOB users.
Bypasses Odoo RPC entirely — writes directly to the database.
Run: python pg_setup.py
"""
import subprocess, sys, json, hashlib, base64, os

# ── PostgreSQL connection ─────────────────────────────────────────────────────
PG_HOST = "localhost"
PG_PORT = "5432"
PG_DB   = "messob_db"
PG_USER = "odoo"
PG_PASS = "odoo"

# ── Group IDs (confirmed from Odoo) ──────────────────────────────────────────
GROUP = {
    "fleet_user":       48,
    "fleet_dispatcher": 74,
    "fleet_manager":    49,
}

# ── User definitions ──────────────────────────────────────────────────────────
USERS = [
    # (login, password, group_key)
    ("tigist.haile@mesob.com",     "Dispatcher@123", "fleet_dispatcher"),
    ("rahel.mekonnen@mesob.com",   "Dispatcher@123", "fleet_dispatcher"),
    ("dawit.bekele@mesob.com",     "Staff@123",      "fleet_user"),
    ("kebede.worku@mesob.com",     "Staff@123",      "fleet_user"),
    ("abebe.kebede@mesob.com",     "Driver@123",     "fleet_user"),
    ("sara.tesfaye@mesob.com",     "Driver@123",     "fleet_user"),
    ("yonas.girma@mesob.com",      "Driver@123",     "fleet_user"),
    ("mekdes.alemu@mesob.com",     "Driver@123",     "fleet_user"),
    ("hana.worku@mesob.com",       "Driver@123",     "fleet_user"),
    ("tesfaye.mulugeta@mesob.com", "Driver@123",     "fleet_user"),
    ("liya.solomon@mesob.com",     "Driver@123",     "fleet_user"),
    ("biruk.tadesse@mesob.com",    "Mechanic@123",   "fleet_user"),
]

def run_psql(sql):
    """Run SQL via psql command-line tool."""
    env = os.environ.copy()
    env["PGPASSWORD"] = PG_PASS
    result = subprocess.run(
        ["psql", "-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER, "-d", PG_DB,
         "-c", sql, "-t", "-A"],
        capture_output=True, text=True, env=env, timeout=15
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql error: {result.stderr.strip()}")
    return result.stdout.strip()

def psql_available():
    try:
        r = subprocess.run(["psql", "--version"], capture_output=True, timeout=5)
        return r.returncode == 0
    except FileNotFoundError:
        return False

# ── Try psql first ────────────────────────────────────────────────────────────
if psql_available():
    print("\n✅ psql found — using direct PostgreSQL")
    print("="*60)

    # Get user IDs
    print("\n[1] Getting user IDs...")
    for login, password, group_key in USERS:
        try:
            uid_result = run_psql(f"SELECT id FROM res_users WHERE login='{login}';")
            if not uid_result:
                print(f"  ⚠️  NOT FOUND: {login}")
                continue
            uid = int(uid_result.split("\n")[0])

            # Insert group membership (ignore if already exists)
            gid = GROUP[group_key]
            run_psql(f"""
                INSERT INTO res_groups_users_rel (gid, uid)
                VALUES ({gid}, {uid})
                ON CONFLICT DO NOTHING;
            """)
            print(f"  ✅ {login:38s} → group {group_key} (id={gid})")
        except Exception as e:
            print(f"  ❌ {login}: {e}")

    print("\n[2] Verifying group membership...")
    for gname, gid in GROUP.items():
        count = run_psql(f"SELECT COUNT(*) FROM res_groups_users_rel WHERE gid={gid};")
        print(f"  {gname:<20} (id={gid}): {count} members")

    print("\n✅ Done via psql")

else:
    print("\n⚠️  psql not in PATH — trying Python psycopg2...")
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=PG_HOST, port=PG_PORT, dbname=PG_DB,
            user=PG_USER, password=PG_PASS
        )
        conn.autocommit = False
        cur = conn.cursor()
        print("✅ Connected via psycopg2")

        print("\n[1] Assigning groups...")
        for login, password, group_key in USERS:
            gid = GROUP[group_key]
            cur.execute("SELECT id FROM res_users WHERE login=%s", (login,))
            row = cur.fetchone()
            if not row:
                print(f"  ⚠️  NOT FOUND: {login}")
                continue
            uid = row[0]
            cur.execute("""
                INSERT INTO res_groups_users_rel (gid, uid)
                VALUES (%s, %s) ON CONFLICT DO NOTHING
            """, (gid, uid))
            print(f"  ✅ {login:38s} → {group_key}")

        conn.commit()
        print("\n[2] Verifying...")
        for gname, gid in GROUP.items():
            cur.execute("SELECT COUNT(*) FROM res_groups_users_rel WHERE gid=%s", (gid,))
            count = cur.fetchone()[0]
            print(f"  {gname:<20} (id={gid}): {count} members")

        cur.close()
        conn.close()
        print("\n✅ Done via psycopg2")

    except ImportError:
        print("❌ psycopg2 not installed. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
        print("Installed. Please run this script again.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("\nManual SQL to run in pgAdmin or psql:")
        print("="*60)
        for login, password, group_key in USERS:
            gid = GROUP[group_key]
            print(f"-- {login}")
            print(f"INSERT INTO res_groups_users_rel (gid, uid)")
            print(f"SELECT {gid}, id FROM res_users WHERE login='{login}'")
            print(f"ON CONFLICT DO NOTHING;")
        sys.exit(1)
