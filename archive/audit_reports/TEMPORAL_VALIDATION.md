# Temporal Validation System

## Overview

The Temporal Validation System tracks detections across multiple video frames to distinguish real road defects from false positives (shadows, reflections, water, lane markings, etc.).

## Core Principle

```
ONE OBSERVATION = POSSIBLE EVENT
MULTIPLE CONSISTENT OBSERVATIONS = STRONGER EVIDENCE
```

A single-frame detection is unreliable. Only detections that persist across multiple frames with consistent position and confidence are validated as real events.

## Architecture

### Pipeline Flow

```
Frame N   → Detection Engine → Raw Detections
Frame N+1 → Detection Engine → Raw Detections
Frame N+2 → Detection Engine → Raw Detections
                ↓
        Temporal Validator
                ↓
    ┌───────────┴───────────┐
    ↓                       ↓
Validated              Rejected
Detections             Detections
    ↓                       ↓
Event Candidates      Rejection Log
```

### Components

1. **TemporalValidator** - Core tracking and validation logic
2. **TrackedDetection** - Represents a detection being tracked across frames
3. **EventCandidate** - Validated detection ready for multi-pass verification
4. **TemporalValidationMetrics** - Performance and accuracy metrics

## How It Works

### 1. Detection Tracking

Each raw detection is matched to an existing track using **Intersection over Union (IoU)**:

```typescript
IoU = Area of Intersection / Area of Union
```

- IoU > threshold (default 0.5) → Same detection, update track
- IoU < threshold → New detection, create new track

### 2. Persistence Tracking

Tracks maintain:
- `frame_count` - Number of frames where detection appeared
- `confidence_history` - Confidence values across frames
- `bbox_history` - Bounding box positions across frames
- `frame_references` - All frame numbers where detection was seen

### 3. Validation Criteria

A track is **validated** when:
- ✅ Appears in ≥ `min_persistence_frames` (default: 3)
- ✅ Average confidence ≥ `confidence_threshold` (default: 0.6)
- ✅ Consistent position (high IoU between consecutive frames)

A track is **rejected** when:
- ❌ Disappears for > `max_disappearance_frames` (default: 2)
- ❌ Average confidence < `confidence_threshold`
- ❌ Track age > `max_track_age_frames` (default: 30)

### 4. Validation Score

Calculated from three factors:

```typescript
validation_score = (
  persistence_score * 0.4 +    // How many frames it appeared
  confidence_score * 0.4 +     // Average confidence
  consistency_score * 0.2      // Position stability (IoU between frames)
)
```

## Configuration

```typescript
interface TemporalValidationConfig {
  min_persistence_frames: number;    // Default: 3
  iou_threshold: number;             // Default: 0.5
  max_disappearance_frames: number;  // Default: 2
  confidence_threshold: number;      // Default: 0.6
  max_track_age_frames: number;      // Default: 30
}
```

### Parameter Tuning

**For higher precision (fewer false positives):**
- Increase `min_persistence_frames` to 5-7
- Increase `confidence_threshold` to 0.7-0.8
- Decrease `max_disappearance_frames` to 1

**For higher recall (fewer missed detections):**
- Decrease `min_persistence_frames` to 2
- Decrease `confidence_threshold` to 0.5
- Increase `max_disappearance_frames` to 3-4

## Metrics

The system tracks:

| Metric | Description |
|--------|-------------|
| `total_raw_detections` | All detections from CV engine |
| `total_validated_detections` | Detections that passed validation |
| `total_rejected_detections` | Detections that failed validation |
| `validation_rate` | validated / raw (higher = more strict) |
| `rejection_rate` | rejected / raw (higher = more strict) |
| `avg_persistence` | Average frames for validated detections |
| `avg_validation_score` | Average validation score |
| `active_track_count` | Currently tracked detections |

## Usage

### Basic Usage

```typescript
import { TemporalValidator } from './cv/temporal';

const validator = new TemporalValidator({
  min_persistence_frames: 3,
  iou_threshold: 0.5,
  max_disappearance_frames: 2,
  confidence_threshold: 0.6,
  max_track_age_frames: 30
});

// Process each frame
const result = validator.processFrame(detections, frameNumber);

// Access results
console.log('Validated:', result.validated_detections);
console.log('Rejected:', result.rejected_detections);
console.log('Metrics:', result.metrics);

// Get event candidates
const candidates = validator.getEventCandidates();
```

### Integration with CV Engine

```typescript
import { RoadDefectDetector } from './cv/RoadDefectDetector';
import { TemporalValidator } from './cv/temporal';

const detector = new RoadDefectDetector(config);
const validator = new TemporalValidator(validationConfig);

async function processVideo(videoUrl: string) {
  // For each frame
  const detectionResult = await detector.detect(frame, frameNumber, timestamp);
  const validationResult = validator.processFrame(detectionResult.detections, frameNumber);
  
  // Use validated detections
  for (const track of validationResult.validated_detections) {
    console.log(`Validated ${track.detection.object_type} at frame ${track.last_seen_frame}`);
  }
}
```

## Demo

The interactive demo (`TemporalValidationDemo.tsx`) shows:

1. **Synthetic detection sequence** with various scenarios:
   - Stable detections (validated)
   - Unstable detections (rejected)
   - Low confidence detections (rejected)
   - Multiple detections per frame

2. **Real-time visualization** of:
   - Active tracks with validation status
   - Event candidates with validation scores
   - Frame-by-frame detection processing
   - Metrics dashboard

3. **Interactive parameter tuning**:
   - Adjust validation parameters with sliders
   - See immediate impact on validation results
   - Compare validation vs rejection rates

## Example Scenarios

### Scenario 1: Shadow (Rejected)

```
Frame 0: Detection at (100, 150), confidence 0.7
Frame 1: Detection at (105, 155), confidence 0.65
Frame 2: No detection (shadow moved)
Frame 3: Detection at (110, 160), confidence 0.68

Result: REJECTED - disappeared for > max_disappearance_frames
```

### Scenario 2: Real Pothole (Validated)

```
Frame 0: Detection at (200, 300), confidence 0.85
Frame 1: Detection at (202, 301), confidence 0.87
Frame 2: Detection at (201, 300), confidence 0.86
Frame 3: Detection at (203, 302), confidence 0.88
Frame 4: Detection at (202, 301), confidence 0.89

Result: VALIDATED - persistence 5 frames, avg confidence 0.87
```

### Scenario 3: Water Reflection (Rejected)

```
Frame 0: Detection at (150, 200), confidence 0.55
Frame 1: Detection at (155, 205), confidence 0.52
Frame 2: Detection at (160, 210), confidence 0.48
Frame 3: Detection at (165, 215), confidence 0.45

Result: REJECTED - avg confidence 0.50 < threshold 0.60
```

## Performance

### Computational Complexity

- **IoU Calculation**: O(1) per detection pair
- **Track Matching**: O(D × T) where D = detections, T = active tracks
- **Overall per frame**: O(D × T)

### Memory Usage

- Each track stores: detection history, bbox history, confidence history
- Typical memory: ~1-2 KB per active track
- With 100 active tracks: ~100-200 KB

### Processing Speed

- Typical processing: < 1ms per frame (excluding CV engine)
- Can handle 30+ FPS real-time processing

## Limitations

1. **Stationary Camera Assumption**: Assumes camera is moving with bus, so static objects appear to move
2. **Occlusion Handling**: Limited handling of temporary occlusions
3. **Fast-Moving Objects**: May struggle with very fast-moving detections
4. **Similar Objects**: May confuse similar objects close together

## Future Enhancements

1. **Kalman Filter**: Predict detection position for better matching
2. **Deep SORT**: Learn appearance features for better tracking
3. **Multi-Camera Fusion**: Combine tracks from multiple cameras
4. **Adaptive Thresholds**: Adjust parameters based on road type/conditions
5. **Motion Compensation**: Account for camera movement in IoU calculation

## Integration with Multi-Pass Verification

Temporal validation is **Layer 1** of the verification pipeline:

```
Layer 1: Temporal Validation (this system)
  - Single bus, multiple frames
  - Filters false positives from CV engine
  
Layer 2: Multi-Pass Verification (next system)
  - Multiple buses, same location
  - Confirms events across fleet
  
Layer 3: Priority Scoring
  - Severity, frequency, recency
  - Determines maintenance priority
```

## Testing

### Unit Tests

```typescript
describe('TemporalValidator', () => {
  it('should validate stable detections', () => {
    const validator = new TemporalValidator(config);
    
    // Add same detection across 5 frames
    for (let i = 0; i < 5; i++) {
      const result = validator.processFrame([stableDetection], i);
    }
    
    expect(result.validated_detections.length).toBe(1);
  });
  
  it('should reject unstable detections', () => {
    const validator = new TemporalValidator(config);
    
    // Add detection, then remove it
    validator.processFrame([detection], 0);
    validator.processFrame([], 1);
    validator.processFrame([], 2);
    const result = validator.processFrame([], 3);
    
    expect(result.rejected_detections.length).toBe(1);
  });
});
```

### Integration Tests

Test with real CV engine output:
1. Process test video with known defects
2. Verify correct detections are validated
3. Verify false positives are rejected
4. Measure validation/rejection rates

## References

- **IoU (Intersection over Union)**: Standard object detection metric
- **Deep SORT**: Simple Online and Realtime Tracking with Deep Association
- **ByteTrack**: High-performance multi-object tracking
- **Kalman Filter**: Optimal state estimation for tracking

## Files

- `src/cv/temporal/types.ts` - Type definitions
- `src/cv/temporal/TemporalValidator.ts` - Core validation logic
- `src/cv/temporal/index.ts` - Module exports
- `src/components/TemporalValidationDemo.tsx` - Interactive demo
- `TEMPORAL_VALIDATION.md` - This documentation
