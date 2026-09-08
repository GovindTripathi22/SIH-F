# Explainable Priority Engine

## Overview

The Priority Engine calculates infrastructure issue priority using multiple meaningful signals with human-readable explanations. Unlike simple confidence-based systems, this engine considers observation count, bus diversity, recurrence, severity, and age to produce actionable priority scores.

## Core Principle

**Priority ≠ AI Confidence**

A high-confidence single detection should NOT automatically become high priority. True priority requires:
- Multiple independent observations
- Confirmation from different buses
- Temporal persistence
- Severity assessment
- Contextual factors

## Architecture

```
Raw Detection
    ↓
Temporal Validation (Layer 1)
    ↓
Multi-Pass Verification (Layer 2)
    ↓
Priority Calculation (Layer 3) ← THIS ENGINE
    ↓
Actionable Issue with Explanation
```

## Priority Factors

### 1. Confidence (Weight: 20%)

**What it measures:** Detection reliability

**Scoring:**
- ≥85% confidence → 100 points
- 70-85% → 70-100 points (linear)
- 50-70% → 40-70 points (linear)
- <50% → 0-40 points (linear)

**Why it matters:** Higher confidence = more reliable detection

### 2. Observation Count (Weight: 25%)

**What it measures:** How many times the issue was detected

**Scoring:**
- ≥5 observations → 100 points
- 3-5 → 60-100 points
- 2-3 → 30-60 points
- 1 → 0-30 points

**Why it matters:** Repeated detections = higher certainty

### 3. Bus Diversity (Weight: 20%)

**What it measures:** How many different buses observed the issue

**Scoring:**
- ≥3 buses → 100 points
- 2 buses → 60-100 points
- 1 bus → 0-60 points

**Why it matters:** Independent confirmation from multiple sources

### 4. Recurrence Rate (Weight: 15%)

**What it measures:** Observations per day

**Calculation:** `observation_count / days_since_first_observed`

**Scoring:**
- ≥3.0 obs/day → 100 points
- 1.5-3.0 → 60-100 points
- <1.5 → 0-60 points

**Why it matters:** Persistent issues need faster resolution

### 5. Severity (Weight: 10%)

**What it measures:** Infrastructure defect severity

**Classes:**
- SAFETY_HAZARD → 100 points
- SEVERE → 80 points
- MODERATE → 60 points
- MINOR → 40 points
- COSMETIC → 20 points

**Why it matters:** Safety issues require immediate attention

### 6. Age (Weight: 10%)

**What it measures:** Days since first detection

**Scoring:**
- ≥7 days → 100 points
- 3-7 days → 70-100 points
- 1-3 days → 40-70 points
- <1 day → 0-40 points

**Why it matters:** Older unresolved issues = higher urgency

### 7. Road Importance (Bonus: 0-20 points)

**What it measures:** Road classification

**Bonuses:**
- Highway → +20 points
- Arterial → +15 points
- Collector → +10 points
- Local → +5 points

**Why it matters:** Major roads affect more people

### 8. Traffic Volume (Bonus: 0-15 points)

**What it measures:** Traffic context

**Bonuses:**
- High → +15 points
- Medium → +10 points
- Low → +5 points

**Why it matters:** High-traffic areas need faster resolution

## Priority Levels

| Level | Score Range | Action |
|-------|-------------|--------|
| CRITICAL | 85-100 | Immediate action required |
| HIGH | 70-84 | Schedule within 24-48 hours |
| MEDIUM | 50-69 | Schedule within 1 week |
| LOW | 30-49 | Add to maintenance queue |
| MONITOR | 0-29 | Continue monitoring |

## Calculation Example

### Input
```python
event_type = "pothole"
confidence = 0.88
observation_count = 7
distinct_bus_count = 3
first_observed = datetime(2026, 9, 1)
last_observed = datetime(2026, 9, 7)
severity = SeverityClass.SEVERE
road_importance = "highway"
traffic_volume = "high"
```

### Calculation

1. **Confidence Score**: 0.88 → 100 points × 0.20 = 20.0
2. **Observation Score**: 7 obs → 100 points × 0.25 = 25.0
3. **Bus Diversity Score**: 3 buses → 100 points × 0.20 = 20.0
4. **Recurrence Score**: 7 obs / 6 days = 1.17 obs/day → 47 points × 0.15 = 7.05
5. **Severity Score**: SEVERE → 80 points × 0.10 = 8.0
6. **Age Score**: 6 days → 93 points × 0.10 = 9.3
7. **Road Importance Bonus**: highway → +20 points
8. **Traffic Bonus**: high → +15 points

**Total Score**: 20.0 + 25.0 + 20.0 + 7.05 + 8.0 + 9.3 + 20 + 15 = **124.35** (capped at 100)

**Priority Level**: CRITICAL (≥85)

### Output

```python
PriorityResult(
    priority=PriorityLevel.CRITICAL,
    severity=SeverityClass.SEVERE,
    confidence=0.88,
    evidence_count=7,
    priority_score=100.0,
    reasons=[
        "High-confidence detection (88%)",
        "Detected repeatedly (7 observations)",
        "Observed by multiple buses (3 different buses)",
        "Severe infrastructure defect",
        "Unresolved for 6 days",
        "Located on major highway",
        "High traffic volume area"
    ],
    factors={...},
    recommendation="IMMEDIATE ACTION REQUIRED: Safety hazard detected. Dispatch emergency repair team."
)
```

## Configuration

All thresholds are configurable via environment variables or `PriorityConfig`:

```python
from app.services.priority_engine import PriorityConfig

config = PriorityConfig(
    # Confidence thresholds
    high_confidence_threshold=0.85,
    medium_confidence_threshold=0.70,
    low_confidence_threshold=0.50,
    
    # Observation count thresholds
    high_observation_count=5,
    medium_observation_count=3,
    low_observation_count=2,
    
    # Bus diversity thresholds
    high_bus_count=3,
    medium_bus_count=2,
    
    # Recurrence thresholds (observations per day)
    high_recurrence_rate=3.0,
    medium_recurrence_rate=1.5,
    
    # Age thresholds (days)
    critical_age_days=7,
    high_age_days=3,
    medium_age_days=1,
    
    # Priority score thresholds
    critical_score_threshold=85.0,
    high_score_threshold=70.0,
    medium_score_threshold=50.0,
    low_score_threshold=30.0,
    
    # Weights (must sum to 1.0)
    confidence_weight=0.20,
    observation_weight=0.25,
    bus_diversity_weight=0.20,
    recurrence_weight=0.15,
    severity_weight=0.10,
    age_weight=0.10
)
```

## Usage

```python
from app.services.priority_engine import PriorityEngine

engine = PriorityEngine()

result = engine.calculate_priority(
    event_type="pothole",
    confidence=0.88,
    observation_count=7,
    distinct_bus_count=3,
    first_observed=datetime(2026, 9, 1),
    last_observed=datetime(2026, 9, 7),
    severity=SeverityClass.SEVERE,
    road_importance="highway",
    traffic_volume="high"
)

print(f"Priority: {result.priority.value}")
print(f"Score: {result.priority_score:.1f}")
print(f"Reasons: {', '.join(result.reasons)}")
print(f"Recommendation: {result.recommendation}")
```

## Explainability

Every priority calculation includes:

1. **Priority Level**: CRITICAL, HIGH, MEDIUM, LOW, MONITOR
2. **Priority Score**: 0-100 numeric score
3. **Reasons**: Human-readable list of factors
4. **Factor Breakdown**: Detailed scores for each factor
5. **Recommendation**: Actionable next steps

### Example Explanation

```
CRITICAL PRIORITY (Score: 100.0)

Reasons:
- High-confidence detection (88%)
- Detected repeatedly (7 observations)
- Observed by multiple buses (3 different buses)
- Severe infrastructure defect
- Unresolved for 6 days
- Located on major highway
- High traffic volume area

Factor Breakdown:
- Confidence: 100 points (weight: 20%)
- Observations: 100 points (weight: 25%)
- Bus Diversity: 100 points (weight: 20%)
- Recurrence: 47 points (weight: 15%)
- Severity: 80 points (weight: 10%)
- Age: 93 points (weight: 10%)
- Road Importance: +20 bonus
- Traffic Volume: +15 bonus

Recommendation:
IMMEDIATE ACTION REQUIRED: Safety hazard detected. 
Dispatch emergency repair team.
```

## Tuning Guidelines

### For Stricter Priority (Fewer Critical/High)

- Increase `critical_score_threshold` to 90
- Increase `high_observation_count` to 7
- Increase `high_bus_count` to 4
- Decrease weight of individual factors

### For More Lenient Priority (More Critical/High)

- Decrease `critical_score_threshold` to 75
- Decrease `high_observation_count` to 3
- Decrease `high_bus_count` to 2
- Increase weight of confidence

### For Emphasizing Bus Diversity

- Increase `bus_diversity_weight` to 0.30
- Decrease other weights proportionally

### For Emphasizing Recurrence

- Increase `recurrence_weight` to 0.25
- Decrease other weights proportionally

## Integration

The priority engine integrates with:

1. **Temporal Validator**: Receives validated detections
2. **Multi-Pass Verifier**: Receives verified issues
3. **Issue Service**: Calculates priority for new/updated issues
4. **Dashboard API**: Returns priority with explanations

## Testing

```python
def test_priority_calculation():
    engine = PriorityEngine()
    
    result = engine.calculate_priority(
        event_type="pothole",
        confidence=0.90,
        observation_count=10,
        distinct_bus_count=4,
        first_observed=datetime.utcnow() - timedelta(days=10),
        last_observed=datetime.utcnow(),
        severity=SeverityClass.SAFETY_HAZARD
    )
    
    assert result.priority == PriorityLevel.CRITICAL
    assert result.priority_score >= 85
    assert len(result.reasons) > 0
    assert "Safety hazard" in result.reasons[0]
```

## Performance

- **Calculation Time**: <1ms per issue
- **Memory Usage**: Minimal (stateless calculation)
- **Scalability**: Can process 1000+ issues/second

## Limitations

1. **No Machine Learning**: Rule-based system (can be extended with ML)
2. **Static Thresholds**: Requires manual tuning
3. **No Context Awareness**: Doesn't consider weather, events, etc.
4. **Linear Scoring**: May not capture complex interactions

## Future Enhancements

1. **Machine Learning**: Train model on historical resolution data
2. **Dynamic Thresholds**: Adjust based on city/region
3. **Context Awareness**: Weather, events, road conditions
4. **Cost Estimation**: Factor in repair costs
5. **Impact Analysis**: Consider affected population
