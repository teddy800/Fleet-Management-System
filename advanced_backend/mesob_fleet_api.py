# MESOB Fleet Management - Advanced Backend API Reference
# This file is a REFERENCE/DESIGN document for a standalone FastAPI service
# that wraps the Odoo backend with additional capabilities.
# It is NOT part of the Odoo module and is NOT imported by Odoo.
#
# To run this as a standalone service:
#   pip install fastapi uvicorn aiohttp pyjwt redis
#   uvicorn advanced_backend.mesob_fleet_api:app --host 0.0.0.0 --port 8000

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

# ── Optional dependency guards ────────────────────────────────────────────────
try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False
    logger.warning("aiohttp not installed — async HTTP calls unavailable. pip install aiohttp")

try:
    import jwt
    HAS_JWT = True
except ImportError:
    HAS_JWT = False
    logger.warning("PyJWT not installed. pip install pyjwt")

try:
    import redis as redis_lib
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    logger.warning("redis not installed. pip install redis")

try:
    from fastapi import FastAPI, HTTPException, WebSocket
    from fastapi.middleware.cors import CORSMiddleware
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False
    logger.warning("FastAPI not installed. pip install fastapi uvicorn")

try:
    from celery import Celery
    HAS_CELERY = True
except ImportError:
    HAS_CELERY = False
    logger.warning("Celery not installed. pip install celery")


# ── FastAPI app (only created if FastAPI is available) ────────────────────────
if HAS_FASTAPI:
    app = FastAPI(
        title="MESOB Fleet Management API",
        version="2.0.0",
        description="Advanced REST API wrapping the Odoo fleet management backend",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app = None


class MesobFleetAPI:
    """
    Advanced fleet management API service.
    Wraps Odoo JSON-RPC with async support, JWT auth, Redis caching,
    and WebSocket real-time tracking.
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.odoo_url = config.get('odoo_url', 'http://localhost:8069')
        self.database = config.get('database', 'messob_db')

        self.redis = None
        if HAS_REDIS:
            try:
                self.redis = redis_lib.Redis(
                    host=config.get('redis_host', 'localhost'),
                    port=6379, db=0, decode_responses=True,
                )
                self.redis.ping()
            except Exception:
                self.redis = None
                logger.warning("Redis connection failed — caching disabled")

        self.celery_app = None
        if HAS_CELERY:
            self.celery_app = Celery(
                'mesob_fleet',
                broker=config.get('celery_broker', 'redis://localhost:6379/0'),
            )

    async def call_odoo(self, model: str, method: str,
                        args: List = None, kwargs: Dict = None) -> Any:
        """Async Odoo JSON-RPC call"""
        if not HAS_AIOHTTP:
            raise RuntimeError("aiohttp required: pip install aiohttp")
        payload = {
            'jsonrpc': '2.0', 'method': 'call', 'id': 1,
            'params': {
                'model': model, 'method': method,
                'args': args or [], 'kwargs': kwargs or {},
            },
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.odoo_url}/web/dataset/call_kw",
                json=payload, timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                result = await resp.json()
        if 'error' in result:
            raise RuntimeError(f"Odoo error: {result['error']}")
        return result.get('result')

    async def authenticate(self, username: str, password: str) -> Dict[str, Any]:
        """Authenticate against Odoo and return JWT token"""
        if not HAS_AIOHTTP:
            raise RuntimeError("aiohttp required")
        payload = {
            'jsonrpc': '2.0', 'method': 'call', 'id': 1,
            'params': {'db': self.database, 'login': username, 'password': password},
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.odoo_url}/web/session/authenticate", json=payload,
            ) as resp:
                result = await resp.json()

        uid = result.get('result', {}).get('uid')
        if not uid:
            raise ValueError("Invalid credentials")

        if HAS_JWT:
            token = jwt.encode(
                {
                    'user_id': uid,
                    'username': username,
                    'exp': datetime.utcnow() + timedelta(hours=24),
                },
                self.config.get('jwt_secret', 'change-me'),
                algorithm='HS256',
            )
        else:
            token = None

        return {'user_id': uid, 'token': token}

    def cache_set(self, key: str, value: Any, ttl: int = 300):
        if self.redis:
            self.redis.setex(key, ttl, json.dumps(value, default=str))

    def cache_get(self, key: str) -> Optional[Any]:
        if self.redis:
            val = self.redis.get(key)
            return json.loads(val) if val else None
        return None

    async def get_fleet_vehicles(self) -> List[Dict]:
        """Get all vehicles with caching"""
        cached = self.cache_get('fleet:vehicles')
        if cached:
            return cached
        vehicles = await self.call_odoo(
            'fleet.vehicle', 'search_read', [[]],
            {'fields': ['name', 'license_plate', 'mesob_status',
                        'current_odometer', 'maintenance_due',
                        'current_latitude', 'current_longitude', 'last_gps_update']},
        )
        self.cache_set('fleet:vehicles', vehicles, ttl=30)
        return vehicles

    async def handle_websocket_tracking(self, websocket) -> None:
        """Stream real-time vehicle locations over WebSocket"""
        if not HAS_FASTAPI:
            return
        import asyncio
        await websocket.accept()
        try:
            while True:
                vehicles = await self.get_fleet_vehicles()
                locations = [
                    {
                        'id': v['id'],
                        'name': v['name'],
                        'lat': v.get('current_latitude', 0),
                        'lng': v.get('current_longitude', 0),
                        'status': v.get('mesob_status', 'unknown'),
                        'ts': str(v.get('last_gps_update', '')),
                    }
                    for v in vehicles
                ]
                await websocket.send_json({
                    'type': 'location_update',
                    'data': locations,
                    'timestamp': datetime.utcnow().isoformat(),
                })
                await asyncio.sleep(5)
        except Exception as e:
            logger.error("WebSocket error: %s", e)
        finally:
            await websocket.close()


# ── Register FastAPI routes ───────────────────────────────────────────────────
CONFIG = {
    'odoo_url': 'http://localhost:8069',
    'database': 'messob_db',
    'jwt_secret': 'change-this-in-production',
    'redis_host': 'localhost',
    'celery_broker': 'redis://localhost:6379/0',
}

if HAS_FASTAPI and app is not None:
    fleet_api = MesobFleetAPI(CONFIG)

    @app.post("/api/v2/auth/login")
    async def login(credentials: dict):
        try:
            return await fleet_api.authenticate(
                credentials['username'], credentials['password']
            )
        except ValueError as e:
            raise HTTPException(status_code=401, detail=str(e))

    @app.get("/api/v2/fleet/vehicles")
    async def get_vehicles():
        return await fleet_api.get_fleet_vehicles()

    @app.websocket("/ws/fleet/tracking")
    async def ws_tracking(websocket: WebSocket):
        await fleet_api.handle_websocket_tracking(websocket)

    @app.get("/health")
    async def health():
        return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    if not HAS_FASTAPI:
        print("FastAPI not installed. Run: pip install fastapi uvicorn aiohttp")
    else:
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=8000)
