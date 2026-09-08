"""
GPS Robustness, Map Matching, and Noise Handling Service.
"""

from typing import Tuple, List, Optional, Dict
import math
from app.models.spatial import haversine_distance_meters


class GPSService:
    """Provides GPS validation, outlier rejection, corridor snapping, and noise tolerance testing."""

    @staticmethod
    def is_valid_coordinate(lat: float, lon: float) -> bool:
        """Verify coordinate falls within legitimate geographic bounds."""
        return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0

    @staticmethod
    def validate_reading(lat: float, lon: float, accuracy_meters: Optional[float] = None) -> Tuple[bool, str]:
        """Validate single GPS reading with accuracy bounds."""
        if not GPSService.is_valid_coordinate(lat, lon):
            return False, "Coordinate out of valid WGS84 range"
        
        # Check for null island (0, 0)
        if abs(lat) < 0.0001 and abs(lon) < 0.0001:
            return False, "Suspicious Null Island coordinate (0, 0)"

        # Check GPS reported dilution of precision / accuracy
        if accuracy_meters is not None and accuracy_meters > 50.0:
            return False, f"GPS accuracy too poor: {accuracy_meters}m > 50m threshold"

        return True, "Valid"

    @staticmethod
    def snap_to_route_segment(
        lat: float,
        lon: float,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float
    ) -> Tuple[float, float, float]:
        """
        Snap a point (lat, lon) to the nearest point on a linear segment between start and end.
        Returns: (snapped_lat, snapped_lon, cross_track_distance_meters).
        """
        # Vector projection in local equirectangular approximation
        x = lon - start_lon
        y = lat - start_lat
        dx = end_lon - start_lon
        dy = end_lat - start_lat

        seg_len_sq = dx * dx + dy * dy
        if seg_len_sq < 1e-12:
            dist = haversine_distance_meters(lat, lon, start_lat, start_lon)
            return start_lat, start_lon, dist

        t = max(0.0, min(1.0, (x * dx + y * dy) / seg_len_sq))
        snapped_lon = start_lon + t * dx
        snapped_lat = start_lat + t * dy
        dist = haversine_distance_meters(lat, lon, snapped_lat, snapped_lon)

        return snapped_lat, snapped_lon, dist

    @staticmethod
    def evaluate_noise_impact(
        base_lat: float,
        base_lon: float,
        noise_levels_meters: List[float] = [5.0, 10.0, 20.0, 30.0]
    ) -> Dict[str, any]:
        """
        Simulate GPS noise at specified meter deviations and measure cluster preservation.
        Returns accuracy and deviation impact report.
        """
        results = {}
        for noise in noise_levels_meters:
            # Shift latitude by noise in meters: 1 deg lat ~ 111,320m
            d_lat = noise / 111320.0
            noisy_lat = base_lat + d_lat
            noisy_lon = base_lon

            measured_distance = haversine_distance_meters(base_lat, base_lon, noisy_lat, noisy_lon)
            cluster_preserved = measured_distance <= 25.0  # within 25m cluster threshold

            results[f"{noise}m_noise"] = {
                "injected_noise_m": noise,
                "measured_drift_m": round(measured_distance, 2),
                "cluster_preserved": cluster_preserved,
                "recommended_buffer_m": round(measured_distance * 1.25, 2)
            }
        return results
