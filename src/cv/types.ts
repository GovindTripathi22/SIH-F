/**
 * Computer Vision Engine Types
 * Clean abstraction for detection engines
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  object_type: 'pothole' | 'road_crack' | 'vehicle' | 'person' | 'road_sign';
  confidence: number;
  bbox: BoundingBox;
  frame_timestamp: number;
  camera_id: string;
  bus_id: string;
  frame_number: number;
}

export interface DetectionResult {
  detections: Detection[];
  frame_number: number;
  timestamp: number;
  inference_time_ms: number;
  fps: number;
}

export interface DetectionEngineConfig {
  confidence_threshold: number;
  frame_skip: number;
  camera_id: string;
  bus_id: string;
  max_detections_per_frame?: number;
}

export interface DetectionEngine {
  /**
   * Initialize the detection engine
   */
  initialize(): Promise<void>;

  /**
   * Process a single frame and return detections
   */
  detect(frame: HTMLCanvasElement | ImageBitmap | HTMLVideoElement, frameNumber: number, timestamp: number): Promise<DetectionResult>;

  /**
   * Check if engine is ready
   */
  isReady(): boolean;

  /**
   * Get engine metadata
   */
  getMetadata(): EngineMetadata;

  /**
   * Cleanup resources
   */
  dispose(): void;
}

export interface EngineMetadata {
  name: string;
  version: string;
  type: 'yolo' | 'image-processing' | 'ml-model';
  supported_classes: string[];
  input_size: { width: number; height: number };
}
