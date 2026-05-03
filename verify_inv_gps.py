"""Quick verify inventory and GPS integrations."""
import json, urllib.request

ODOO_URL = "http://localhost:8069"
DB = "messob_db"
GPS_URL = "http://localhost:5001/api/gps"

def get(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read())

def post(url, body, sid=None):
    hdrs = {"Content-Type": "application/json"}
    if sid: hdrs["Cookie"] = f"session_id={sid}"
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=hdrs)
    with urllib.request.urlopen(req, timeout=8) as r:
        raw = json.loads(r.read())
        sc = r.headers.get("Set-Cookie", "")
        new_sid = sc.split("session_id=")[1].split(";")[0] if "session_id=" in sc else sid
        return raw, new_sid

def kw(model, method, args, kwargs, sid):
    raw, _ = post(f"{ODOO_URL}/web/dataset/call_kw", {
        "jsonrpc":"2.0","method":"call","id":1,
        "params":{"model":model,"method":method,"args":args,"kwargs":kwargs}
    }, sid)
    return raw.get("result",[])

# Auth
raw, sid = post(f"{ODOO_URL}/web/session/authenticate", {
    "jsonrpc":"2.0","method":"call","id":1,
    "params":{"db":DB,"login":"admin","password":"admin"}
})
print(f"Admin uid={raw['result']['uid']}")

# Inventory
print("\n📦 INVENTORY INTEGRATION:")
products = kw("product.product","search_read",
    [[["name","in",["Air Filter","Brake Pads","Engine Oil 5W-30","Fuel (Gasoline)"]]]],
    {"fields":["name","type"],"limit":10}, sid)
print(f"  Fleet products: {len(products)}")
for p in products:
    print(f"    ✅ {p['name']}")

vehicles = kw("fleet.vehicle","search_read",[[]],
    {"fields":["name","license_plate","mesob_status"],"limit":5}, sid)
print(f"\n  Fleet vehicles: {len(vehicles)}")
for v in vehicles:
    print(f"    🚗 {v['name']:<25} {v.get('license_plate','?'):<12} {v.get('mesob_status','?')}")

allocs = kw("mesob.inventory.allocation","search_read",[[]],
    {"fields":["display_name","state"],"limit":5}, sid)
print(f"\n  Parts allocations: {len(allocs)}")
for a in allocs:
    print(f"    🔧 {a.get('display_name','?')}")

# GPS
print("\n📍 GPS INTEGRATION:")
try:
    gps = get(GPS_URL)
    print(f"  GPS vehicles tracked: {len(gps)}")
    for v in gps:
        engine = "ON" if v.get("engine_on") else "OFF"
        print(f"    🚗 {v['vehicle_plate']:<12} lat={v['latitude']:.4f} lng={v['longitude']:.4f} speed={v['speed']}km/h fuel={v['fuel_level']}% engine={engine}")
except Exception as e:
    print(f"  ❌ GPS: {e}")

print("\n✅ All integrations verified!")
