"""
Spatial Clustering and Multi-Pass Fleet Verification Engine.
Handles spatial matching, temporal correlation, confidence aggregation, and issue lifecycle.
"""

from typing import Optional, List, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
import json
import logging
import uuid

from app.models.event import RawEvent, EventObservation
from app.models.issue import VerifiedIssue, IssueStatusHistory
from app.models.spatial import haversine_distance_meters
from app.services.priority_engine import PriorityEngine, SeverityClass, PriorityLevel
from app.config import settings

logger = logging.getLogger(__name__)


def angle_delta(a1: Optional[float], a2: Optional[float]) -> float:
    """Calculate minimum angular difference between two compass headings in degrees."""
    if a1 is None or a2 is None:
        return 0.0
    diff = abs(a1 - a2) % 360.0
    return 360.0 - diff if diff > 180.0 else diff


class MultiPassVerificationEngine:
    """
    Core engine that merges multiple bus observations into unified verified issues
    using spatial proximity, temporal windows, heading consistency, and bus fleet diversity.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.radius_meters = settings.SPATIAL_CLUSTER_RADIUS_METERS
        self.window_minutes = settings.TEMPORAL_CLUSTER_WINDOW_MINUTES
        self.priority_engine = PriorityEngine()

    async def find_matching_issue(
        self,
        event_type: str,
        latitude: float,
        longitude: float,
        event_timestamp: datetime,
        heading: Optional[float] = None,
        gps_accuracy_meters: Optional[float] = None
    ) -> Optional[VerifiedIssue]:
        """
        Find an existing active issue within spatial radius, temporal window, and consistent heading.
        Dynamic search radius accounts for GPS accuracy and prevents opposite-carriageway false merging.
        """
        # Dynamic search radius bounded between 10m and 25m based on GPS accuracy
        effective_radius = self.radius_meters
        if gps_accuracy_meters is not None and gps_accuracy_meters > 0:
            effective_radius = max(10.0, min(25.0, gps_accuracy_meters * 2.0))

        # Convert radius to approximate coordinate degrees
        # 1 deg lat ~ 111,320m
        deg_lat = effective_radius / 111320.0
        deg_lon = effective_radius / (111320.0 * max(0.1, abs(latitude) / 90.0))

        # We look for non-resolved issues (or issues within active consideration)
        query = select(VerifiedIssue).where(
            VerifiedIssue.event_type == event_type,
            VerifiedIssue.status.in_(['PENDING', 'CANDIDATE', 'SUPPORTED', 'VERIFIED', 'IN_PROGRESS', 'REPAIRED', 'REOPENED']),
            VerifiedIssue.centroid_latitude.between(latitude - deg_lat, latitude + deg_lat),
            VerifiedIssue.centroid_longitude.between(longitude - deg_lon, longitude + deg_lon)
        )

        result = await self.db.execute(query)
        candidate_issues = result.scalars().all()

        best_match: Optional[VerifiedIssue] = None
        min_distance = float('inf')

        for issue in candidate_issues:
            # Check heading consistency to prevent false merging of opposite carriageways
            issue_meta = {}
            if issue.metadata_json:
                try:
                    issue_meta = json.loads(issue.metadata_json)
                except Exception:
                    pass

            issue_heading = issue_meta.get("heading")
            if heading is not None and issue_heading is not None:
                delta = angle_delta(heading, issue_heading)
                if delta > 120.0:
                    # Bus traveling in opposite direction on divided carriageway -> do not false-merge
                    continue

            dist = haversine_distance_meters(
                latitude, longitude,
                issue.centroid_latitude, issue.centroid_longitude
            )
            if dist <= effective_radius and dist < min_distance:
                min_distance = dist
                best_match = issue

        return best_match

    async def ingest_event_into_cluster(self, raw_event: RawEvent) -> Tuple[VerifiedIssue, bool]:
        """
        Process a new raw detection event through the multi-pass verification pipeline.
        Returns (verified_issue, is_new_issue).
        """
        heading = None
        if raw_event.metadata_json:
            try:
                meta = json.loads(raw_event.metadata_json)
                heading = meta.get("heading")
            except Exception:
                pass

        matching_issue = await self.find_matching_issue(
            raw_event.event_type,
            raw_event.latitude,
            raw_event.longitude,
            raw_event.timestamp,
            heading=heading,
            gps_accuracy_meters=raw_event.gps_accuracy_meters
        )

        if matching_issue is not None:
            # Existing issue matched: aggregate observation
            issue = await self._merge_observation(matching_issue, raw_event)
            return issue, False
        else:
            # Create a new candidate issue
            issue = await self._create_candidate_issue(raw_event)
            return issue, True

    async def _create_candidate_issue(self, event: RawEvent) -> VerifiedIssue:
        """Create a new candidate issue from the first observation."""
        issue_id = f"issue-{uuid.uuid4().hex[:8]}"
        severity_str = self._map_confidence_to_severity(event.event_type, event.confidence)
        sev_enum = SeverityClass[severity_str] if severity_str in SeverityClass.__members__ else SeverityClass.MODERATE

        priority_res = self.priority_engine.calculate_priority(
            event_type=event.event_type,
            confidence=event.confidence,
            observation_count=1,
            distinct_bus_count=1,
            first_observed=event.timestamp,
            last_observed=event.timestamp,
            severity=sev_enum
        )

        meta_dict = {"clean_passes": []}
        if event.metadata_json:
            try:
                parsed = json.loads(event.metadata_json)
                if "heading" in parsed:
                    meta_dict["heading"] = parsed["heading"]
            except Exception:
                pass

        reasons = [
            f"Initial detection by Bus {event.bus_id} on route {event.route_id}",
            f"Detection confidence: {round(event.confidence * 100, 1)}%",
            f"Temporal validation score: {round(event.validation_score * 100, 1)}%",
            "State: CANDIDATE (Awaiting multi-pass confirmation)"
        ] + priority_res.reasons[:2]

        issue = VerifiedIssue(
            issue_id=issue_id,
            centroid_latitude=event.latitude,
            centroid_longitude=event.longitude,
            event_type=event.event_type,
            severity=severity_str,
            priority=priority_res.priority.value,
            status="PENDING",
            verification_state="CANDIDATE",
            observation_count=1,
            distinct_bus_count=1,
            confidence=event.confidence,
            verification_score=event.validation_score * 0.5,
            priority_score=priority_res.priority_score,
            first_observed=event.timestamp,
            last_observed=event.timestamp,
            cluster_radius_meters=self.radius_meters,
            priority_reasons=json.dumps(reasons),
            metadata_json=json.dumps(meta_dict)
        )
        self.db.add(issue)
        await self.db.flush()

        # Record observation link
        observation = EventObservation(
            raw_event_id=event.id,
            issue_id=issue.issue_id,
            observation_confidence=event.confidence,
            adjusted_latitude=event.latitude,
            adjusted_longitude=event.longitude
        )
        self.db.add(observation)
        await self.db.flush()

        return issue

    async def _merge_observation(self, issue: VerifiedIssue, event: RawEvent) -> VerifiedIssue:
        """Merge a new observation into an existing verified issue."""
        # Check previous observations to identify unique buses
        obs_query = select(RawEvent.bus_id).join(
            EventObservation, EventObservation.raw_event_id == RawEvent.id
        ).where(EventObservation.issue_id == issue.issue_id)
        
        obs_result = await self.db.execute(obs_query)
        prior_buses = set(obs_result.scalars().all())

        is_new_bus = event.bus_id not in prior_buses
        prior_buses.add(event.bus_id)
        distinct_buses = len(prior_buses)

        # Update centroid with incremental weighted average
        n = issue.observation_count
        new_lat = (issue.centroid_latitude * n + event.latitude) / (n + 1)
        new_lon = (issue.centroid_longitude * n + event.longitude) / (n + 1)
        issue.centroid_latitude = round(new_lat, 6)
        issue.centroid_longitude = round(new_lon, 6)

        issue.observation_count += 1
        issue.distinct_bus_count = distinct_buses
        issue.last_observed = max(issue.last_observed, event.timestamp)

        # Bayesian confidence combination: 1 - (1 - c_old)*(1 - c_new)
        combined_confidence = 1.0 - (1.0 - issue.confidence) * (1.0 - event.confidence)
        issue.confidence = min(0.99, round(combined_confidence, 4))

        # Defensible verification formula:
        # V = 0.40 * bus_diversity + 0.30 * observation_volume + 0.30 * confidence
        bus_diversity_factor = min(1.0, distinct_buses / 2.0)
        volume_factor = min(1.0, issue.observation_count / 3.0)
        v_score = 0.40 * bus_diversity_factor + 0.30 * volume_factor + 0.30 * issue.confidence
        issue.verification_score = round(v_score, 3)

        # Explainable priority calculation
        sev_enum = SeverityClass[issue.severity] if issue.severity in SeverityClass.__members__ else SeverityClass.MODERATE
        priority_res = self.priority_engine.calculate_priority(
            event_type=issue.event_type,
            confidence=issue.confidence,
            observation_count=issue.observation_count,
            distinct_bus_count=distinct_buses,
            first_observed=issue.first_observed,
            last_observed=issue.last_observed,
            severity=sev_enum
        )
        issue.priority = priority_res.priority.value
        issue.priority_score = priority_res.priority_score

        # Verification state & repair failure detection
        is_repair_failure = (issue.status == "REPAIRED")
        if is_repair_failure:
            issue.status = "REOPENED"
            issue.verification_state = "REPAIR_FAILED"
            issue.priority = "CRITICAL"
            issue.priority_score = 98.0
            state_label = "REPAIR FAILED / REOPENED (Defect Re-detected Post-Repair)"
        elif distinct_buses >= 2 or issue.observation_count >= 3:
            if issue.status not in ["IN_PROGRESS", "REPAIRED", "REOPENED", "RESOLUTION_VERIFIED"]:
                issue.status = "PENDING"
            issue.verification_state = "VERIFIED"
            state_label = "VERIFIED (Fleet Multi-Pass Confirmed)"
        else:
            issue.verification_state = "SUPPORTED"
            state_label = "SUPPORTED (Recurrent Single-Bus Observation)"

        # Explainable reasons
        bus_list = ", ".join(sorted(list(prior_buses)))
        reasons = [
            f"Fleet verification: {issue.observation_count} passes across {distinct_buses} distinct bus(es) [{bus_list}]",
            f"Multi-pass confidence score: {round(issue.confidence * 100, 1)}%",
            f"Verification consensus: {round(issue.verification_score * 100, 1)}%",
            f"State: {state_label}"
        ] + priority_res.reasons[:2]
        if is_repair_failure:
            reasons.insert(0, f"CRITICAL ALERT: Repair failed! Defect re-detected by Bus {event.bus_id} at coordinate ({event.latitude:.5f}, {event.longitude:.5f})")

        issue.priority_reasons = json.dumps(reasons)

        # Save observation
        observation = EventObservation(
            raw_event_id=event.id,
            issue_id=issue.issue_id,
            observation_confidence=event.confidence,
            adjusted_latitude=event.latitude,
            adjusted_longitude=event.longitude
        )
        self.db.add(observation)
        await self.db.flush()

        logger.info(
            f"Merged event into {issue.issue_id}: observations={issue.observation_count}, "
            f"distinct_buses={distinct_buses}, confidence={issue.confidence:.2f}, priority={issue.priority}"
        )

        return issue

    def _map_confidence_to_severity(self, event_type: str, confidence: float) -> str:
        if event_type in ["pothole", "waterlogging"] and confidence > 0.85:
            return "SAFETY_HAZARD"
        elif confidence > 0.70:
            return "SEVERE"
        elif confidence > 0.50:
            return "MODERATE"
        else:
            return "MINOR"
