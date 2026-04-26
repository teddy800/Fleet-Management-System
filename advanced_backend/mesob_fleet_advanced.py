# MESOB Fleet Management System - Advanced Backend Integration Reference
# This file is a REFERENCE/DESIGN document showing advanced integration patterns.
# It is NOT part of the Odoo module and is NOT imported by Odoo.
#
# To use these patterns, install the required packages separately:
#   pip install requests aiohttp fastapi uvicorn redis celery pyjwt bcrypt geopy
#
# These are standalone Python services that communicate with Odoo via its JSON-RPC API.

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Optional dependency guards ────────────────────────────────────────────────
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    import jwt
    HAS_JWT = True
except ImportError:
    HAS_JWT = False

try:
    import redis as redis_lib
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

try:
    from celery import Celery
    HAS_CELERY = True
except ImportError:
    HAS_CELERY = False

try:
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    HAS_SMTP = True
except ImportError:
    HAS_SMTP = False

try:
    import geopy.distance
    from geopy.geocoders import Nominatim
    HAS_GEOPY = True
except ImportError:
    HAS_GEOPY = False


class MesobFleetAdvanced:
    """
    Advanced fleet management integration patterns.
    Demonstrates how to extend the Odoo-based system with:
    - JWT authentication for external services
    - Redis caching for performance
    - Celery background tasks
    - Email/SMS notifications
    - Geofencing with geopy
    """

    def __init__(self, config: Dict):
        self.config = config
        self.odoo_url = config.get('odoo_url', 'http://localhost:8069')
        self.database = config.get('database', 'messob_db')

        if HAS_REDIS:
            self.redis = redis_lib.Redis(
                host=config.get('redis_host', 'localhost'),
                port=config.get('redis_port', 6379),
                db=0,
                decode_responses=True,
            )
        else:
            self.redis = None
            logger.warning("Redis not available — caching disabled")

        if HAS_CELERY:
            self.celery = Celery(
                'mesob_fleet',
                broker=config.get('celery_broker', 'redis://localhost:6379/0'),
            )
        else:
            self.celery = None
            logger.warning("Celery not available — background tasks disabled")

    def call_odoo(self, model: str, method: str, args=None, kwargs=None) -> dict:
        """Generic Odoo JSON-RPC call"""
        if not HAS_REQUESTS:
            raise RuntimeError("requests library required: pip install requests")
        payload = {
            'jsonrpc': '2.0', 'method': 'call', 'id': 1,
            'params': {
                'model': model, 'method': method,
                'args': args or [], 'kwargs': kwargs or {},
            },
        }
        resp = requests.post(
            f"{self.odoo_url}/web/dataset/call_kw",
            json=payload, timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
        if 'error' in result:
            raise RuntimeError(f"Odoo error: {result['error']}")
        return result.get('result')

    def generate_jwt_token(self, user_id: int, roles: List[str]) -> str:
        """Generate JWT token for external service authentication"""
        if not HAS_JWT:
            raise RuntimeError("PyJWT required: pip install pyjwt")
        payload = {
            'user_id': user_id,
            'roles': roles,
            'exp': datetime.utcnow() + timedelta(hours=24),
            'iat': datetime.utcnow(),
        }
        return jwt.encode(payload, self.config['jwt_secret'], algorithm='HS256')

    def cache_set(self, key: str, value, ttl: int = 300):
        """Cache a value in Redis"""
        if self.redis:
            self.redis.setex(key, ttl, json.dumps(value))

    def cache_get(self, key: str):
        """Get a cached value from Redis"""
        if self.redis:
            val = self.redis.get(key)
            return json.loads(val) if val else None
        return None

    def send_email_notification(self, to: str, subject: str, body: str):
        """Send email notification via SMTP"""
        if not HAS_SMTP:
            logger.warning("SMTP not available")
            return False
        try:
            msg = MIMEMultipart()
            msg['From'] = self.config.get('smtp_from', 'noreply@mesob.com')
            msg['To'] = to
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'html'))
            with smtplib.SMTP(
                self.config.get('smtp_host', 'localhost'),
                self.config.get('smtp_port', 587),
            ) as server:
                server.starttls()
                server.login(
                    self.config.get('smtp_user', ''),
                    self.config.get('smtp_password', ''),
                )
                server.send_message(msg)
            return True
        except Exception as e:
            logger.error("Email send failed: %s", e)
            return False

    def calculate_distance_km(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two GPS coordinates"""
        if HAS_GEOPY:
            return geopy.distance.geodesic((lat1, lng1), (lat2, lng2)).km
        # Fallback: Haversine formula
        import math
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlng / 2) ** 2)
        return R * 2 * math.asin(math.sqrt(a))

    def reverse_geocode(self, lat: float, lng: float) -> str:
        """Convert GPS coordinates to human-readable address"""
        if not HAS_GEOPY:
            return f"Lat: {lat:.4f}, Lng: {lng:.4f}"
        try:
            geolocator = Nominatim(user_agent="mesob_fleet")
            location = geolocator.reverse(f"{lat}, {lng}", timeout=5)
            return location.address if location else f"{lat:.4f}, {lng:.4f}"
        except Exception:
            return f"{lat:.4f}, {lng:.4f}"


# ── Example usage ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    config = {
        'odoo_url': 'http://localhost:8069',
        'database': 'messob_db',
        'jwt_secret': 'change-this-in-production',
        'redis_host': 'localhost',
        'celery_broker': 'redis://localhost:6379/0',
        'smtp_host': 'smtp.gmail.com',
        'smtp_port': 587,
        'smtp_user': 'your-email@gmail.com',
        'smtp_password': 'your-app-password',
        'smtp_from': 'noreply@mesob.com',
    }
    api = MesobFleetAdvanced(config)
    dist = api.calculate_distance_km(9.0054, 38.7636, 9.0120, 38.7700)
    print(f"Distance: {dist:.2f} km")
