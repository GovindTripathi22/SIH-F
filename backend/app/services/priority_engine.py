"""
Explainable Urban-Issue Priority Engine

Calculates priority scores using multiple meaningful signals with human-readable explanations.
All thresholds are configurable and scoring logic is transparent.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class PriorityLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    MONITOR = "MONITOR"


class SeverityClass(str, Enum):
    SAFETY_HAZARD = "SAFETY_HAZARD"
    SEVERE = "SEVERE"
    MODERATE = "MODERATE"
    MINOR = "MINOR"
    COSMETIC = "COSMETIC"


@dataclass
class PriorityConfig:
    """Configurable thresholds for priority calculation"""
    
    # Confidence thresholds
    high_confidence_threshold: float = 0.85
    medium_confidence_threshold: float = 0.70
    low_confidence_threshold: float = 0.50
    
    # Observation count thresholds
    high_observation_count: int = 5
    medium_observation_count: int = 3
    low_observation_count: int = 2
    
    # Bus diversity thresholds
    high_bus_count: int = 3
    medium_bus_count: int = 2
    
    # Recurrence thresholds (observations per day)
    high_recurrence_rate: float = 3.0
    medium_recurrence_rate: float = 1.5
    
    # Age thresholds (days)
    critical_age_days: int = 7
    high_age_days: int = 3
    medium_age_days: int = 1
    
    # Priority score thresholds
    critical_score_threshold: float = 85.0
    high_score_threshold: float = 70.0
    medium_score_threshold: float = 50.0
    low_score_threshold: float = 30.0
    
    # Weights for different factors (must sum to 1.0)
    confidence_weight: float = 0.20
    observation_weight: float = 0.25
    bus_diversity_weight: float = 0.20
    recurrence_weight: float = 0.15
    severity_weight: float = 0.10
    age_weight: float = 0.10


@dataclass
class PriorityResult:
    """Result of priority calculation with explanation"""
    priority: PriorityLevel
    severity: SeverityClass
    confidence: float
    evidence_count: int
    priority_score: float
    reasons: List[str]
    factors: Dict[str, Any]
    recommendation: str


class PriorityEngine:
    """
    Explainable priority calculation engine.
    
    Calculates priority using multiple signals:
    - Event confidence
    - Number of independent observations
    - Number of distinct buses
    - Recurrence rate
    - Severity class
    - Age of unresolved issue
    - Road importance (if available)
    - Traffic context (if available)
    """
    
    def __init__(self, config: Optional[PriorityConfig] = None):
        self.config = config or PriorityConfig()
        self._validate_config()
    
    def _validate_config(self):
        """Validate configuration weights sum to 1.0"""
        total_weight = (
            self.config.confidence_weight +
            self.config.observation_weight +
            self.config.bus_diversity_weight +
            self.config.recurrence_weight +
            self.config.severity_weight +
            self.config.age_weight
        )
        
        if abs(total_weight - 1.0) > 0.01:
            raise ValueError(f"Priority weights must sum to 1.0, got {total_weight}")
    
    def calculate_priority(
        self,
        event_type: str,
        confidence: float,
        observation_count: int,
        distinct_bus_count: int,
        first_observed: datetime,
        last_observed: datetime,
        severity: Optional[SeverityClass] = None,
        road_importance: Optional[str] = None,
        traffic_volume: Optional[str] = None,
        current_time: Optional[datetime] = None
    ) -> PriorityResult:
        """
        Calculate priority with full explanation.
        
        Args:
            event_type: Type of event (pothole, crack, etc.)
            confidence: Average confidence score (0-1)
            observation_count: Total number of observations
            distinct_bus_count: Number of distinct buses that observed
            first_observed: When first detected
            last_observed: When last detected
            severity: Severity classification (auto-detected if None)
            road_importance: Road classification (highway, arterial, local)
            traffic_volume: Traffic context (high, medium, low)
            current_time: Current time for age calculation
            
        Returns:
            PriorityResult with score, level, and human-readable reasons
        """
        current_time = current_time or datetime.now(timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)
        if first_observed.tzinfo is None:
            first_observed = first_observed.replace(tzinfo=timezone.utc)
        if last_observed.tzinfo is None:
            last_observed = last_observed.replace(tzinfo=timezone.utc)

        reasons = []
        factors = {}
        score = 0.0
        
        # Auto-detect severity if not provided
        if severity is None:
            severity = self._infer_severity(event_type, confidence)
        
        # 1. Confidence Score (0-100)
        confidence_score = self._calculate_confidence_score(confidence)
        factors['confidence'] = {
            'value': confidence,
            'score': confidence_score,
            'weight': self.config.confidence_weight
        }
        score += confidence_score * self.config.confidence_weight
        
        if confidence >= self.config.high_confidence_threshold:
            reasons.append(f"High-confidence detection ({confidence:.0%})")
        elif confidence >= self.config.medium_confidence_threshold:
            reasons.append(f"Moderate-confidence detection ({confidence:.0%})")
        
        # 2. Observation Count Score (0-100)
        observation_score = self._calculate_observation_score(observation_count)
        factors['observations'] = {
            'value': observation_count,
            'score': observation_score,
            'weight': self.config.observation_weight
        }
        score += observation_score * self.config.observation_weight
        
        if observation_count >= self.config.high_observation_count:
            reasons.append(f"Detected repeatedly ({observation_count} observations)")
        elif observation_count >= self.config.medium_observation_count:
            reasons.append(f"Multiple observations ({observation_count} times)")
        
        # 3. Bus Diversity Score (0-100)
        bus_score = self._calculate_bus_diversity_score(distinct_bus_count)
        factors['bus_diversity'] = {
            'value': distinct_bus_count,
            'score': bus_score,
            'weight': self.config.bus_diversity_weight
        }
        score += bus_score * self.config.bus_diversity_weight
        
        if distinct_bus_count >= self.config.high_bus_count:
            reasons.append(f"Observed by multiple buses ({distinct_bus_count} different buses)")
        elif distinct_bus_count >= self.config.medium_bus_count:
            reasons.append(f"Confirmed by {distinct_bus_count} buses")
        
        # 4. Recurrence Rate Score (0-100)
        recurrence_rate = self._calculate_recurrence_rate(
            first_observed, last_observed, observation_count
        )
        recurrence_score = self._calculate_recurrence_score(recurrence_rate)
        factors['recurrence'] = {
            'value': recurrence_rate,
            'score': recurrence_score,
            'weight': self.config.recurrence_weight
        }
        score += recurrence_score * self.config.recurrence_weight
        
        if recurrence_rate >= self.config.high_recurrence_rate:
            reasons.append(f"High recurrence rate ({recurrence_rate:.1f} observations/day)")
        elif recurrence_rate >= self.config.medium_recurrence_rate:
            reasons.append(f"Persistent issue ({recurrence_rate:.1f} observations/day)")
        
        # 5. Severity Score (0-100)
        severity_score = self._calculate_severity_score(severity)
        factors['severity'] = {
            'value': severity.value,
            'score': severity_score,
            'weight': self.config.severity_weight
        }
        score += severity_score * self.config.severity_weight
        
        if severity == SeverityClass.SAFETY_HAZARD:
            reasons.append("Safety hazard detected")
        elif severity == SeverityClass.SEVERE:
            reasons.append("Severe infrastructure defect")
        
        # 6. Age Score (0-100) - older unresolved issues get higher priority
        age_days = (current_time - first_observed).days
        age_score = self._calculate_age_score(age_days)
        factors['age'] = {
            'value': age_days,
            'score': age_score,
            'weight': self.config.age_weight
        }
        score += age_score * self.config.age_weight
        
        if age_days >= self.config.critical_age_days:
            reasons.append(f"Unresolved for {age_days} days (critical)")
        elif age_days >= self.config.high_age_days:
            reasons.append(f"Unresolved for {age_days} days")
        
        # 7. Road Importance Bonus (0-20 points)
        if road_importance:
            importance_bonus = self._calculate_road_importance_bonus(road_importance)
            factors['road_importance'] = {
                'value': road_importance,
                'bonus': importance_bonus
            }
            score += importance_bonus
            if road_importance == "highway":
                reasons.append("Located on major highway")
            elif road_importance == "arterial":
                reasons.append("Located on arterial road")
        
        # 8. Traffic Context Bonus (0-15 points)
        if traffic_volume:
            traffic_bonus = self._calculate_traffic_bonus(traffic_volume)
            factors['traffic'] = {
                'value': traffic_volume,
                'bonus': traffic_bonus
            }
            score += traffic_bonus
            if traffic_volume == "high":
                reasons.append("High traffic volume area")
        
        # Cap score at 100
        priority_score = min(score, 100.0)
        
        # Determine priority level
        priority = self._determine_priority_level(priority_score)
        
        # Generate recommendation
        recommendation = self._generate_recommendation(priority, severity, factors)
        
        return PriorityResult(
            priority=priority,
            severity=severity,
            confidence=confidence,
            evidence_count=observation_count,
            priority_score=priority_score,
            reasons=reasons,
            factors=factors,
            recommendation=recommendation
        )
    
    def _calculate_confidence_score(self, confidence: float) -> float:
        """Calculate score based on confidence (0-100)"""
        if confidence >= self.config.high_confidence_threshold:
            return 100.0
        elif confidence >= self.config.medium_confidence_threshold:
            return 70.0 + (confidence - self.config.medium_confidence_threshold) / \
                   (self.config.high_confidence_threshold - self.config.medium_confidence_threshold) * 30.0
        elif confidence >= self.config.low_confidence_threshold:
            return 40.0 + (confidence - self.config.low_confidence_threshold) / \
                   (self.config.medium_confidence_threshold - self.config.low_confidence_threshold) * 30.0
        else:
            return confidence / self.config.low_confidence_threshold * 40.0
    
    def _calculate_observation_score(self, count: int) -> float:
        """Calculate score based on observation count (0-100)"""
        if count >= self.config.high_observation_count:
            return 100.0
        elif count >= self.config.medium_observation_count:
            return 60.0 + (count - self.config.medium_observation_count) / \
                   (self.config.high_observation_count - self.config.medium_observation_count) * 40.0
        elif count >= self.config.low_observation_count:
            return 30.0 + (count - self.config.low_observation_count) / \
                   (self.config.medium_observation_count - self.config.low_observation_count) * 30.0
        else:
            return count / self.config.low_observation_count * 30.0
    
    def _calculate_bus_diversity_score(self, count: int) -> float:
        """Calculate score based on distinct bus count (0-100)"""
        if count >= self.config.high_bus_count:
            return 100.0
        elif count >= self.config.medium_bus_count:
            return 60.0 + (count - self.config.medium_bus_count) / \
                   (self.config.high_bus_count - self.config.medium_bus_count) * 40.0
        elif count >= 1:
            return 30.0 + (count - 1) / (self.config.medium_bus_count - 1) * 30.0
        else:
            return 0.0
    
    def _calculate_recurrence_rate(
        self, first_observed: datetime, last_observed: datetime, count: int
    ) -> float:
        """Calculate observations per day"""
        duration_days = max((last_observed - first_observed).total_seconds() / 86400, 0.1)
        return count / duration_days
    
    def _calculate_recurrence_score(self, rate: float) -> float:
        """Calculate score based on recurrence rate (0-100)"""
        if rate >= self.config.high_recurrence_rate:
            return 100.0
        elif rate >= self.config.medium_recurrence_rate:
            return 60.0 + (rate - self.config.medium_recurrence_rate) / \
                   (self.config.high_recurrence_rate - self.config.medium_recurrence_rate) * 40.0
        else:
            return rate / self.config.medium_recurrence_rate * 60.0
    
    def _calculate_severity_score(self, severity: SeverityClass) -> float:
        """Calculate score based on severity class (0-100)"""
        severity_scores = {
            SeverityClass.SAFETY_HAZARD: 100.0,
            SeverityClass.SEVERE: 80.0,
            SeverityClass.MODERATE: 60.0,
            SeverityClass.MINOR: 40.0,
            SeverityClass.COSMETIC: 20.0
        }
        return severity_scores.get(severity, 50.0)
    
    def _calculate_age_score(self, age_days: int) -> float:
        """Calculate score based on age in days (0-100)"""
        if age_days >= self.config.critical_age_days:
            return 100.0
        elif age_days >= self.config.high_age_days:
            return 70.0 + (age_days - self.config.high_age_days) / \
                   (self.config.critical_age_days - self.config.high_age_days) * 30.0
        elif age_days >= self.config.medium_age_days:
            return 40.0 + (age_days - self.config.medium_age_days) / \
                   (self.config.high_age_days - self.config.medium_age_days) * 30.0
        else:
            return age_days / self.config.medium_age_days * 40.0
    
    def _calculate_road_importance_bonus(self, importance: str) -> float:
        """Calculate bonus points for road importance (0-20)"""
        bonuses = {
            "highway": 20.0,
            "arterial": 15.0,
            "collector": 10.0,
            "local": 5.0
        }
        return bonuses.get(importance.lower(), 0.0)
    
    def _calculate_traffic_bonus(self, volume: str) -> float:
        """Calculate bonus points for traffic volume (0-15)"""
        bonuses = {
            "high": 15.0,
            "medium": 10.0,
            "low": 5.0
        }
        return bonuses.get(volume.lower(), 0.0)
    
    def _infer_severity(self, event_type: str, confidence: float) -> SeverityClass:
        """Infer severity from event type and confidence"""
        severity_map = {
            "pothole_large": SeverityClass.SEVERE,
            "pothole": SeverityClass.MODERATE,
            "road_crack": SeverityClass.MINOR,
            "debris": SeverityClass.MODERATE,
            "sign_damage": SeverityClass.MINOR,
            "safety_hazard": SeverityClass.SAFETY_HAZARD
        }
        
        base_severity = severity_map.get(event_type.lower(), SeverityClass.MINOR)
        
        # Upgrade severity if confidence is very high
        if confidence >= 0.95 and base_severity == SeverityClass.MODERATE:
            return SeverityClass.SEVERE
        
        return base_severity
    
    def _determine_priority_level(self, score: float) -> PriorityLevel:
        """Determine priority level from score"""
        if score >= self.config.critical_score_threshold:
            return PriorityLevel.CRITICAL
        elif score >= self.config.high_score_threshold:
            return PriorityLevel.HIGH
        elif score >= self.config.medium_score_threshold:
            return PriorityLevel.MEDIUM
        elif score >= self.config.low_score_threshold:
            return PriorityLevel.LOW
        else:
            return PriorityLevel.MONITOR
    
    def _generate_recommendation(
        self, priority: PriorityLevel, severity: SeverityClass, factors: Dict
    ) -> str:
        """Generate human-readable recommendation"""
        if priority == PriorityLevel.CRITICAL:
            if severity == SeverityClass.SAFETY_HAZARD:
                return "IMMEDIATE ACTION REQUIRED: Safety hazard detected. Dispatch emergency repair team."
            return "URGENT: Critical infrastructure issue. Schedule immediate repair."
        elif priority == PriorityLevel.HIGH:
            return "HIGH PRIORITY: Schedule repair within 24-48 hours."
        elif priority == PriorityLevel.MEDIUM:
            return "Schedule repair within 1 week."
        elif priority == PriorityLevel.LOW:
            return "Add to maintenance queue. Monitor for changes."
        else:
            return "Continue monitoring. Collect more observations before action."
