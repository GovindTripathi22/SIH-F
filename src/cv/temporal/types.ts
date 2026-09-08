/**
 * Temporal Validation Types
 * 
 * Tracks detections across frames to validate consistency
 * and filter out false positives (shadows, reflections, etc.)
 */

import { Detection } from '../types';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrackedDetection {
  track_id: string;
  detection: Detection;
  first_seen_frame: number;
  last_seen_frame: number;
  frame_count: number;
  confidence_history: number[];
  bbox_history: BoundingBox[];
  frame_references: number[]; // All frame numbers where this detection appeared
  is_validated: boolean;
  validation_score: number;
  rejection_reason?: string;
}

export interface TemporalValidationConfig {
  min_persistence_frames: number;  // Minimum frames a detection must appear
  iou_threshold: number;           // IoU threshold for matching (0.0 - 1.0)
  max_disappearance_frames: number; // Max frames a detection can disappear before track is lost
  confidence_threshold: number;    // Minimum average confidence for validation
  max_track_age_frames: number;    // Max age of track before cleanup
}

export interface ValidationResult {
  raw_detections: Detection[];
  validated_detections: TrackedDetection[];
  rejected_detections: TrackedDetection[];
  active_tracks: TrackedDetection[];
  metrics: TemporalValidationMetrics;
}

export interface TemporalValidationMetrics {
  total_raw_detections: number;
  total_validated_detections: number;
  total_rejected_detections: number;
  validation_rate: number;  // validated / raw
  rejection_rate: number;   // rejected / raw
  avg_persistence: number;  // average frame count for validated detections
  avg_validation_score: number;
  active_track_count: number;
}

export interface EventCandidate {
  event_id: string;
  track_id: string;
  detection: Detection;
  validation_score: number;
  persistence_frames: number;
  frame_references: number[];
  confidence_history: number[];
  bbox_history: BoundingBox[];
  created_at: number;
  status: 'candidate' | 'pending_verification' | 'verified' | 'rejected';
}
