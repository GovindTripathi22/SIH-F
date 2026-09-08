/**
 * Video Processing Pipeline
 * 
 * Takes video input and processes it frame-by-frame through the detection engine.
 * Emits structured detections with GPS/timestamp metadata.
 * 
 * This simulates the bus-sensing pipeline:
 * Video Frame + Bus ID + Route ID + GPS + Timestamp → Detection Engine → Structured Events
 */

import { Detection, DetectionEngine, DetectionResult } from './types';

export interface GPSPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface RouteConfig {
  route_id: string;
  bus_id: string;
  camera_id: string;
  gps_track: GPSPoint[];
}

export interface ProcessedEvent {
  detection: Detection;
  gps: GPSPoint;
  route_id: string;
  bus_id: string;
  camera_id: string;
  video_timestamp: number;
}

export interface PipelineStats {
  total_frames: number;
  processed_frames: number;
  skipped_frames: number;
  total_detections: number;
  avg_inference_ms: number;
  avg_fps: number;
  processing_time_ms: number;
}

export interface PipelineCallbacks {
  onFrameProcessed?: (frameNumber: number, result: DetectionResult) => void;
  onEventDetected?: (event: ProcessedEvent) => void;
  onProgress?: (progress: number, stats: PipelineStats) => void;
  onComplete?: (stats: PipelineStats) => void;
  onError?: (error: Error) => void;
}

export class VideoProcessingPipeline {
  private engine: DetectionEngine;
  private route: RouteConfig;
  private callbacks: PipelineCallbacks;
  private running = false;
  private paused = false;
  private videoElement: HTMLVideoElement | null = null;

  constructor(engine: DetectionEngine, route: RouteConfig, callbacks: PipelineCallbacks = {}) {
    this.engine = engine;
    this.route = route;
    this.callbacks = callbacks;
  }

  /**
   * Process a video file from start to finish
   */
  async processVideo(videoUrl: string): Promise<PipelineStats> {
    const startTime = performance.now();
    const stats: PipelineStats = {
      total_frames: 0,
      processed_frames: 0,
      skipped_frames: 0,
      total_detections: 0,
      avg_inference_ms: 0,
      avg_fps: 0,
      processing_time_ms: 0
    };

    let totalInferenceTime = 0;
    let totalFps = 0;

    try {
      // Create video element
      this.videoElement = document.createElement('video');
      this.videoElement.src = videoUrl;
      this.videoElement.crossOrigin = 'anonymous';
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        this.videoElement!.onloadeddata = () => resolve();
        this.videoElement!.onerror = () => reject(new Error('Failed to load video'));
      });

      // Create canvas for frame extraction
      const canvas = document.createElement('canvas');
      canvas.width = this.videoElement.videoWidth;
      canvas.height = this.videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Calculate total frames (estimate based on duration and FPS)
      const videoFps = 30; // Assume 30fps
      const duration = this.videoElement.duration;
      stats.total_frames = Math.floor(duration * videoFps);

      this.running = true;
      let frameNumber = 0;

      // Process frame by frame
      while (this.running && this.videoElement.currentTime < duration) {
        if (this.paused) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        // Draw current frame to canvas
        ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

        // Get GPS position for this timestamp
        const gps = this.getGPSForTimestamp(this.videoElement.currentTime);

        // Run detection
        const result = await this.engine.detect(canvas, frameNumber, this.videoElement.currentTime);

        stats.processed_frames++;
        totalInferenceTime += result.inference_time_ms;
        totalFps += result.fps;

        // Process detections
        for (const detection of result.detections) {
          stats.total_detections++;
          
          const event: ProcessedEvent = {
            detection,
            gps,
            route_id: this.route.route_id,
            bus_id: this.route.bus_id,
            camera_id: this.route.camera_id,
            video_timestamp: this.videoElement.currentTime
          };

          this.callbacks.onEventDetected?.(event);
        }

        this.callbacks.onFrameProcessed?.(frameNumber, result);

        // Update progress
        const progress = this.videoElement.currentTime / duration;
        stats.avg_inference_ms = totalInferenceTime / stats.processed_frames;
        stats.avg_fps = totalFps / stats.processed_frames;
        
        this.callbacks.onProgress?.(progress, stats);

        // Advance video by frame interval
        frameNumber++;
        await new Promise(resolve => setTimeout(resolve, 1000 / videoFps));
        
        // Seek to next frame
        this.videoElement.currentTime = Math.min(
          frameNumber / videoFps,
          duration
        );

        // Wait for seek to complete
        await new Promise<void>(resolve => {
          const onSeeked = () => {
            this.videoElement!.removeEventListener('seeked', onSeeked);
            resolve();
          };
          this.videoElement!.addEventListener('seeked', onSeeked);
        });
      }

      stats.processing_time_ms = performance.now() - startTime;
      this.callbacks.onComplete?.(stats);

      return stats;

    } catch (error) {
      this.callbacks.onError?.(error as Error);
      throw error;
    } finally {
      this.running = false;
      if (this.videoElement) {
        this.videoElement.pause();
        this.videoElement.src = '';
        this.videoElement = null;
      }
    }
  }

  /**
   * Process a single frame (for live/streaming mode)
   */
  async processFrame(
    frame: HTMLCanvasElement | HTMLVideoElement,
    frameNumber: number,
    timestamp: number
  ): Promise<ProcessedEvent[]> {
    const result = await this.engine.detect(frame, frameNumber, timestamp);
    const gps = this.getGPSForTimestamp(timestamp);

    const events: ProcessedEvent[] = result.detections.map(detection => ({
      detection,
      gps,
      route_id: this.route.route_id,
      bus_id: this.route.bus_id,
      camera_id: this.route.camera_id,
      video_timestamp: timestamp
    }));

    for (const event of events) {
      this.callbacks.onEventDetected?.(event);
    }

    return events;
  }

  /**
   * Get GPS position for a given timestamp by interpolating the GPS track
   */
  private getGPSForTimestamp(timestamp: number): GPSPoint {
    const track = this.route.gps_track;
    
    if (track.length === 0) {
      return { latitude: 0, longitude: 0, timestamp };
    }

    if (track.length === 1) {
      return { ...track[0], timestamp };
    }

    // Find the two GPS points surrounding this timestamp
    for (let i = 0; i < track.length - 1; i++) {
      const p1 = track[i];
      const p2 = track[i + 1];

      if (timestamp >= p1.timestamp && timestamp <= p2.timestamp) {
        // Linear interpolation
        const t = (timestamp - p1.timestamp) / (p2.timestamp - p1.timestamp);
        return {
          latitude: p1.latitude + t * (p2.latitude - p1.latitude),
          longitude: p1.longitude + t * (p2.longitude - p1.longitude),
          timestamp
        };
      }
    }

    // If timestamp is beyond the track, return the last point
    return { ...track[track.length - 1], timestamp };
  }

  pause(): void {
    this.paused = true;
    this.videoElement?.pause();
  }

  resume(): void {
    this.paused = false;
    this.videoElement?.play();
  }

  stop(): void {
    this.running = false;
    this.videoElement?.pause();
  }

  isRunning(): boolean {
    return this.running;
  }

  isPaused(): boolean {
    return this.paused;
  }
}
