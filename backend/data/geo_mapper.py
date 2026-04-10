"""
data/geo_mapper.py — IP to geolocation mapper.
Uses the bundled IP pool for deterministic mapping in streaming mode.
Falls back to geoip2 if a GeoLite2 database is present.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Optional

# Canonical IP pool — same as streamer.py
IP_POOL: dict[str, list[tuple[str, float, float]]] = {
    'China':          [('114.114.114.114', 35.86, 104.19), ('223.5.5.5', 30.27, 120.15)],
    'United States':  [('8.8.8.8', 37.09, -95.71), ('1.1.1.1', 34.05, -118.24)],
    'Russia':         [('77.88.8.8', 55.75, 37.61), ('5.255.255.70', 59.93, 30.31)],
    'Germany':        [('85.214.20.141', 52.52, 13.40)],
    'India':          [('49.207.0.1', 28.61, 77.20), ('106.193.0.1', 19.07, 72.87)],
    'Brazil':         [('177.192.0.1', -23.54, -46.63)],
    'United Kingdom': [('81.130.0.1', 51.50, -0.12)],
    'Japan':          [('122.1.0.1', 35.68, 139.69)],
    'South Korea':    [('168.126.63.1', 37.56, 126.97)],
    'Netherlands':    [('9.9.9.9', 52.37, 4.89)],
}

# Flat list for indexed access
_ALL_IPS: list[tuple[str, str, float, float]] = [
    (country, ip, lat, lng)
    for country, entries in IP_POOL.items()
    for ip, lat, lng in entries
]


def get_random_ip_info(seed: Optional[int] = None) -> tuple[str, str, float, float]:
    """
    Returns (country, ip, lat, lng) from pool.
    Uses seed for determinism if provided.
    """
    import random
    rng = random.Random(seed)
    return rng.choice(_ALL_IPS)


def get_country_ip(country: str) -> Optional[tuple[str, float, float]]:
    """Return (ip, lat, lng) for a given country, or None."""
    entries = IP_POOL.get(country)
    if not entries:
        return None
    return entries[0]


def ip_to_geo(ip: str) -> Optional[tuple[str, float, float]]:
    """
    Try geoip2 first (if DB present), then fall back to pool lookup.
    Returns (country, lat, lng) or None.
    """
    db_path = Path('./data/GeoLite2-City.mmdb')
    if db_path.exists():
        try:
            import geoip2.database
            with geoip2.database.Reader(str(db_path)) as reader:
                resp = reader.city(ip)
                country = resp.country.name or 'Unknown'
                lat = float(resp.location.latitude or 0)
                lng = float(resp.location.longitude or 0)
                return country, lat, lng
        except Exception:
            pass

    # Pool lookup by IP
    for country, entries in IP_POOL.items():
        for pool_ip, lat, lng in entries:
            if pool_ip == ip:
                return country, lat, lng
    return None
