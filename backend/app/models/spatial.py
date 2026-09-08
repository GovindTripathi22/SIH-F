"""
Spatial types and utilities supporting both PostgreSQL/PostGIS and SQLite.
"""

from sqlalchemy.types import TypeDecorator, String
from geoalchemy2 import Geography
import math

class SpatialPoint(TypeDecorator):
    """
    Dialect-aware spatial point column.
    - Compiles to Geography('POINT', srid=4326) on PostgreSQL with PostGIS.
    - Compiles to String(100) on SQLite, storing 'POINT(lon lat)'.
    """
    impl = String
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(Geography('POINT', srid=4326))
        return dialect.type_descriptor(String(100))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            return value
        # If tuple of (lat, lon) or (lon, lat)
        if isinstance(value, (tuple, list)) and len(value) == 2:
            return f"POINT({value[1]} {value[0]})"
        return str(value)

    def process_result_value(self, value, dialect):
        return value


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points in meters using the Haversine formula.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return R * c
