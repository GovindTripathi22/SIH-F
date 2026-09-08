/**
 * Temporal Validator
 * 
 * Tracks detections across frames to validate consistency
 * and filter out false positives.
 * 
 * Core principle:
 * ONE OBSERVATION = POSSIBLE EVENT
 * MULTIPLE CONSISTENT OBSERVATIONS = STRONGER EVIDENCE
 */

import { Detection, BoundingBox } from '../types';
import {
  TrackedDetection,
  TemporalValidationConfig,
  ValidationResult,
  TemporalValidationMetrics,
  EventCandidate
} from './types';

export class TemporalValidator {
  private config: TemporalValidationConfig;
  private activeTracks: Map<string, TrackedDetection> = new Map();
  private nextTrackId = 1;
  private metrics: TemporalValidationMetrics;
  private eventCandidates: Map<string, EventCandidate> = new Map();
  private nextEventId = 1;

  constructor(config: TemporalValidationConfig) {
    this.config = config;
    this.metrics = {
      total_raw_detections: 0,
      total_validated_detections: 0,
      total_rejected_detections: 0,
      validation_rate: 0,
      rejection_rate: 0,
      avg_persistence: 0,
      avg_validation_score: 0,
      active_track_count: 0
    };
  }

  /**
   * Process a new frame's detections
   */
  processFrame(detections: Detection[], frameNumber: number): ValidationResult {
    this.metrics.total_raw_detections += detections.length;

    // Match detections to existing tracks
    const matched = new Set<string>();
    const unmatchedDetections: Detection[] = [];

    for (const detection of detections) {
      const matchedTrack = this.matchToTrack(detection, frameNumber);
      
      if (matchedTrack) {
        this.updateTrack(matchedTrack, detection, frameNumber);
        matched.add(matchedTrack.track_id);
      } else {
        unmatchedDetections.push(detection);
      }
    }

    // Create new tracks for unmatched detections
    for (const detection of unmatchedDetections) {
      this.createTrack(detection, frameNumber);
    }

    // Update tracks that weren't matched (mark as disappearing)
    for (const [trackId, track] of this.activeTracks) {
      if (!matched.has(trackId)) {
        this.handleDisappearingTrack(track, frameNumber);
      }
    }

    // Validate tracks and create event candidates
    const validatedDetections: TrackedDetection[] = [];
    const rejectedDetections: TrackedDetection[] = [];

    for (const [trackId, track] of this.activeTracks) {
      const validation = this.validateTrack(track);
      
      if (validation.isValidated) {
        track.is_validated = true;
        track.validation_score = validation.score;
        validatedDetections.push(track);
        this.metrics.total_validated_detections++;

        // Create event candidate if not already created
        if (!this.eventCandidates.has(trackId)) {
          this.createEventCandidate(track);
        }
      } else if (validation.shouldReject) {
        track.is_validated = false;
        track.rejection_reason = validation.reason;
        rejectedDetections.push(track);
        this.metrics.total_rejected_detections++;
        
        // Remove rejected track
        this.activeTracks.delete(trackId);
      }
    }

    // Cleanup old tracks
    this.cleanupOldTracks(frameNumber);

    // Update metrics
    this.updateMetrics();

    return {
      raw_detections: detections,
      validated_detections: validatedDetections,
      rejected_detections: rejectedDetections,
      active_tracks: Array.from(this.activeTracks.values()),
      metrics: { ...this.metrics }
    };
  }

  /**
   * Match a detection to an existing track using IoU
   */
  private matchToTrack(detection: Detection, frameNumber: number): TrackedDetection | null {
    let bestMatch: TrackedDetection | null = null;
    let bestIoU = this.config.iou_threshold;

    for (const track of this.activeTracks.values()) {
      // Only match same object type
      if (track.detection.object_type !== detection.object_type) {
        continue;
      }

      // Check if track has disappeared too long
      const framesSinceLastSeen = frameNumber - track.last_seen_frame;
      if (framesSinceLastSeen > this.config.max_disappearance_frames) {
        continue;
      }

      // Calculate IoU with last known position
      const lastBbox = track.bbox_history[track.bbox_history.length - 1];
      const iou = this.calculateIoU(lastBbox, detection.bbox);

      if (iou > bestIoU) {
        bestIoU = iou;
        bestMatch = track;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate Intersection over Union (IoU) between two bounding boxes
   */
  private calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * Update an existing track with new detection
   */
  private updateTrack(track: TrackedDetection, detection: Detection, frameNumber: number): void {
    track.last_seen_frame = frameNumber;
    track.frame_count++;
    track.confidence_history.push(detection.confidence);
    track.bbox_history.push(detection.bbox);
    track.frame_references.push(frameNumber);
    track.detection = detection; // Update to latest detection
  }

  /**
   * Create a new track for a detection
   */
  private createTrack(detection: Detection, frameNumber: number): void {
    const trackId = `track_${this.nextTrackId++}`;
    
    const track: TrackedDetection = {
      track_id: trackId,
      detection,
      first_seen_frame: frameNumber,
      last_seen_frame: frameNumber,
      frame_count: 1,
      confidence_history: [detection.confidence],
      bbox_history: [detection.bbox],
      frame_references: [frameNumber],
      is_validated: false,
      validation_score: 0
    };

    this.activeTracks.set(trackId, track);
  }

  /**
   * Handle a track that wasn't matched in current frame
   */
  private handleDisappearingTrack(track: TrackedDetection, frameNumber: number): void {
    const framesSinceLastSeen = frameNumber - track.last_seen_frame;
    
    // If disappeared too long, mark for rejection
    if (framesSinceLastSeen > this.config.max_disappearance_frames) {
      if (!track.is_validated) {
        track.rejection_reason = `Disappeared for ${framesSinceLastSeen} frames (max: ${this.config.max_disappearance_frames})`;
        this.metrics.total_rejected_detections++;
        this.activeTracks.delete(track.track_id);
      }
    }
  }

  /**
   * Validate a track based on persistence and confidence
   */
  private validateTrack(track: TrackedDetection): {
    isValidated: boolean;
    shouldReject: boolean;
    score: number;
    reason?: string;
  } {
    // Check minimum persistence
    if (track.frame_count < this.config.min_persistence_frames) {
      return {
        isValidated: false,
        shouldReject: false,
        score: 0,
        reason: `Insufficient persistence: ${track.frame_count}/${this.config.min_persistence_frames} frames`
      };
    }

    // Calculate average confidence
    const avgConfidence = track.confidence_history.reduce((a, b) => a + b, 0) / track.confidence_history.length;

    // Check confidence threshold
    if (avgConfidence < this.config.confidence_threshold) {
      return {
        isValidated: false,
        shouldReject: true,
        score: 0,
        reason: `Low average confidence: ${(avgConfidence * 100).toFixed(1)}% < ${(this.config.confidence_threshold * 100).toFixed(1)}%`
      };
    }

    // Calculate validation score
    const persistenceScore = Math.min(track.frame_count / (this.config.min_persistence_frames * 2), 1);
    const confidenceScore = avgConfidence;
    const consistencyScore = this.calculateConsistencyScore(track);
    
    const validationScore = (persistenceScore * 0.4 + confidenceScore * 0.4 + consistencyScore * 0.2);

    return {
      isValidated: true,
      shouldReject: false,
      score: validationScore
    };
  }

  /**
   * Calculate consistency score based on bbox stability
   */
  private calculateConsistencyScore(track: TrackedDetection): number {
    if (track.bbox_history.length < 2) return 1;

    // Calculate average IoU between consecutive frames
    let totalIoU = 0;
    for (let i = 1; i < track.bbox_history.length; i++) {
      const iou = this.calculateIoU(track.bbox_history[i - 1], track.bbox_history[i]);
      totalIoU += iou;
    }

    return totalIoU / (track.bbox_history.length - 1);
  }

  /**
   * Create an event candidate from a validated track
   */
  private createEventCandidate(track: TrackedDetection): void {
    const eventId = `event_${this.nextEventId++}`;
    
    const candidate: EventCandidate = {
      event_id: eventId,
      track_id: track.track_id,
      detection: track.detection,
      validation_score: track.validation_score,
      persistence_frames: track.frame_count,
      frame_references: [...track.frame_references],
      confidence_history: [...track.confidence_history],
      bbox_history: [...track.bbox_history],
      created_at: Date.now(),
      status: 'candidate'
    };

    this.eventCandidates.set(track.track_id, candidate);
  }

  /**
   * Cleanup old tracks that haven't been seen recently
   */
  private cleanupOldTracks(currentFrame: number): void {
    for (const [trackId, track] of this.activeTracks) {
      const age = currentFrame - track.first_seen_frame;
      if (age > this.config.max_track_age_frames) {
        if (!track.is_validated) {
          track.rejection_reason = `Track too old: ${age} frames (max: ${this.config.max_track_age_frames})`;
          this.metrics.total_rejected_detections++;
        }
        this.activeTracks.delete(trackId);
      }
    }
  }

  /**
   * Update aggregate metrics
   */
  private updateMetrics(): void {
    const validatedTracks = Array.from(this.activeTracks.values()).filter(t => t.is_validated);
    
    this.metrics.active_track_count = this.activeTracks.size;
    
    if (this.metrics.total_raw_detections > 0) {
      this.metrics.validation_rate = this.metrics.total_validated_detections / this.metrics.total_raw_detections;
      this.metrics.rejection_rate = this.metrics.total_rejected_detections / this.metrics.total_raw_detections;
    }

    if (validatedTracks.length > 0) {
      this.metrics.avg_persistence = validatedTracks.reduce((sum, t) => sum + t.frame_count, 0) / validatedTracks.length;
      this.metrics.avg_validation_score = validatedTracks.reduce((sum, t) => sum + t.validation_score, 0) / validatedTracks.length;
    }
  }

  /**
   * Get all event candidates
   */
  getEventCandidates(): EventCandidate[] {
    return Array.from(this.eventCandidates.values());
  }

  /**
   * Get current metrics
   */
  getMetrics(): TemporalValidationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset validator state
   */
  reset(): void {
    this.activeTracks.clear();
    this.eventCandidates.clear();
    this.nextTrackId = 1;
    this.nextEventId = 1;
    this.metrics = {
      total_raw_detections: 0,
      total_validated_detections: 0,
      total_rejected_detections: 0,
      validation_rate: 0,
      rejection_rate: 0,
      avg_persistence: 0,
      avg_validation_score: 0,
      active_track_count: 0
    };
  }
}
