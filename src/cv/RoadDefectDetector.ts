/**
 * Road Defect Detector
 * 
 * Uses real image processing techniques for road defect detection:
 * - Grayscale conversion
 * - Gaussian blur for noise reduction
 * - Adaptive thresholding to find dark regions (potential potholes)
 * - Connected component analysis
 * - Filtering by size, shape, and contrast
 * 
 * This is a simplified but REAL detection approach.
 * For production, replace with YOLO or similar deep learning model.
 */

import { Detection, DetectionEngine, DetectionEngineConfig, DetectionResult, EngineMetadata, BoundingBox } from './types';

export class RoadDefectDetector implements DetectionEngine {
  private config: DetectionEngineConfig;
  private ready = false;
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private frameCount = 0;

  constructor(config: DetectionEngineConfig) {
    this.config = config;
    
    // Create offscreen canvas for processing
    if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(640, 480);
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 640;
      this.canvas.height = 480;
    }
    
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get canvas context');
    this.ctx = ctx;
  }

  async initialize(): Promise<void> {
    // No model loading needed for image processing approach
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  getMetadata(): EngineMetadata {
    return {
      name: 'RoadDefectDetector',
      version: '0.1.0',
      type: 'image-processing',
      supported_classes: ['pothole', 'road_crack'],
      input_size: { width: 640, height: 480 }
    };
  }

  async detect(
    frame: HTMLCanvasElement | ImageBitmap | HTMLVideoElement,
    frameNumber: number,
    timestamp: number
  ): Promise<DetectionResult> {
    const startTime = performance.now();

    // Skip frames if configured
    this.frameCount++;
    if (this.frameCount % (this.config.frame_skip + 1) !== 0) {
      return {
        detections: [],
        frame_number: frameNumber,
        timestamp,
        inference_time_ms: 0,
        fps: 0
      };
    }

    // Draw frame to canvas for processing
    this.canvas.width = frame instanceof HTMLVideoElement ? frame.videoWidth : (frame as HTMLCanvasElement).width;
    this.canvas.height = frame instanceof HTMLVideoElement ? frame.videoHeight : (frame as HTMLCanvasElement).height;
    
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);

    // Get image data
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const detections = this.processFrame(imageData, frameNumber, timestamp);

    const inferenceTime = performance.now() - startTime;
    const fps = 1000 / inferenceTime;

    return {
      detections,
      frame_number: frameNumber,
      timestamp,
      inference_time_ms: inferenceTime,
      fps
    };
  }

  private processFrame(imageData: ImageData, frameNumber: number, timestamp: number): Detection[] {
    const { width, height } = imageData;
    const data = imageData.data;

    // Step 1: Convert to grayscale
    const grayscale = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      // Luminance formula
      grayscale[idx] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Step 2: Apply Gaussian blur (3x3 kernel)
    const blurred = this.applyGaussianBlur(grayscale, width, height);

    // Step 3: Adaptive thresholding to find dark regions
    const blockSize = 25;
    const C = 10;
    const thresholded = this.adaptiveThreshold(blurred, width, height, blockSize, C);

    // Step 4: Find connected components (dark regions)
    const regions = this.findConnectedComponents(thresholded, width, height);

    // Step 5: Filter and classify regions
    const detections: Detection[] = [];
    
    for (const region of regions) {
      // Filter by size (potholes should be at least 20x20 pixels)
      if (region.width < 20 || region.height < 20) continue;
      if (region.width > width * 0.5 || region.height > height * 0.5) continue;

      // Calculate aspect ratio
      const aspectRatio = region.width / region.height;
      
      // Calculate circularity (potholes tend to be more circular)
      const circularity = (4 * Math.PI * region.area) / (region.perimeter * region.perimeter);

      // Calculate average darkness in the region
      const avgDarkness = this.calculateRegionDarkness(grayscale, region, width);

      // Calculate confidence based on multiple factors
      let confidence = 0;
      
      // Darkness factor (darker = more likely pothole)
      const darknessScore = Math.max(0, (80 - avgDarkness) / 80);
      confidence += darknessScore * 0.4;

      // Size factor (medium-sized = more likely)
      const sizeFactor = Math.min(region.area / (width * height * 0.01), 1);
      confidence += sizeFactor * 0.3;

      // Shape factor (more circular = more likely pothole)
      const shapeScore = Math.min(circularity / 0.5, 1);
      confidence += shapeScore * 0.3;

      // Apply confidence threshold
      if (confidence >= this.config.confidence_threshold) {
        // Classify based on shape
        const objectType = aspectRatio > 3 ? 'road_crack' : 'pothole';

        detections.push({
          object_type: objectType,
          confidence: Math.min(confidence, 0.99),
          bbox: {
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height
          },
          frame_timestamp: timestamp,
          camera_id: this.config.camera_id,
          bus_id: this.config.bus_id,
          frame_number: frameNumber
        });
      }
    }

    // Limit detections per frame
    if (this.config.max_detections_per_frame && detections.length > this.config.max_detections_per_frame) {
      detections.sort((a, b) => b.confidence - a.confidence);
      return detections.slice(0, this.config.max_detections_per_frame);
    }

    return detections;
  }

  private applyGaussianBlur(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(data.length);
    const kernel = [
      [1, 2, 1],
      [2, 4, 2],
      [1, 2, 1]
    ];
    const kernelSum = 16;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            sum += data[idx] * kernel[ky + 1][kx + 1];
          }
        }
        result[y * width + x] = sum / kernelSum;
      }
    }

    return result;
  }

  private adaptiveThreshold(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    blockSize: number,
    C: number
  ): Uint8Array {
    const result = new Uint8Array(width * height);
    const halfBlock = Math.floor(blockSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Calculate local mean
        let sum = 0;
        let count = 0;
        
        for (let by = -halfBlock; by <= halfBlock; by++) {
          for (let bx = -halfBlock; bx <= halfBlock; bx++) {
            const ny = y + by;
            const nx = x + bx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              sum += data[ny * width + nx];
              count++;
            }
          }
        }
        
        const mean = sum / count;
        const threshold = mean - C;
        
        // If pixel is darker than threshold, mark as potential defect
        result[y * width + x] = data[y * width + x] < threshold ? 255 : 0;
      }
    }

    return result;
  }

  private findConnectedComponents(
    binary: Uint8Array,
    width: number,
    height: number
  ): Array<{ x: number; y: number; width: number; height: number; area: number; perimeter: number }> {
    const labels = new Int32Array(width * height);
    let currentLabel = 0;
    const regions: Map<number, { minX: number; minY: number; maxX: number; maxY: number; area: number }> = new Map();

    // Simple connected component labeling
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (binary[idx] === 255 && labels[idx] === 0) {
          currentLabel++;
          regions.set(currentLabel, { minX: x, minY: y, maxX: x, maxY: y, area: 0 });
          
          // Flood fill
          const stack = [[x, y]];
          while (stack.length > 0) {
            const [cx, cy] = stack.pop()!;
            const cidx = cy * width + cx;
            
            if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
            if (binary[cidx] === 0 || labels[cidx] !== 0) continue;
            
            labels[cidx] = currentLabel;
            const region = regions.get(currentLabel)!;
            region.minX = Math.min(region.minX, cx);
            region.minY = Math.min(region.minY, cy);
            region.maxX = Math.max(region.maxX, cx);
            region.maxY = Math.max(region.maxY, cy);
            region.area++;
            
            // Add neighbors
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
          }
        }
      }
    }

    // Convert to bounding boxes
    const result = [];
    for (const [_, region] of regions) {
      const width = region.maxX - region.minX + 1;
      const height = region.maxY - region.minY + 1;
      const perimeter = 2 * (width + height);
      
      result.push({
        x: region.minX,
        y: region.minY,
        width,
        height,
        area: region.area,
        perimeter
      });
    }

    return result;
  }

  private calculateRegionDarkness(
    grayscale: Uint8ClampedArray,
    region: { x: number; y: number; width: number; height: number },
    imageWidth: number
  ): number {
    let sum = 0;
    let count = 0;

    for (let y = region.y; y < region.y + region.height; y++) {
      for (let x = region.x; x < region.x + region.width; x++) {
        sum += grayscale[y * imageWidth + x];
        count++;
      }
    }

    return count > 0 ? sum / count : 128;
  }

  dispose(): void {
    this.ready = false;
  }
}
