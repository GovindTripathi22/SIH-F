# Computer Vision Engine Documentation

## Overview

The UrbanPulse CV Engine provides road defect detection capabilities for the bus-sensing simulation layer. It uses a clean abstraction that allows easy swapping between different detection backends.

## Current Implementation

### RoadDefectDetector (Image Processing Based)

**Type:** Traditional computer vision (not deep learning)

**Techniques Used:**
1. Grayscale conversion
2. Gaussian blur (3x3 kernel) for noise reduction
3. Adaptive thresholding to find dark regions
4. Connected component analysis
5. Filtering by size, shape, and contrast
6. Confidence scoring based on darkness, size, and circularity

**Supported Classes:**
- `pothole` - Dark circular/elliptical regions
- `road_crack` - Elongated dark patterns

**Limitations:**
- Lower accuracy compared to deep learning models
- Sensitive to lighting conditions
- May produce false positives on shadows, manholes, etc.
- Not suitable for production without ML model integration

## Architecture

### Clean Interface Abstraction

```typescript
interface DetectionEngine {
  initialize(): Promise<void>;
  detect(frame: HTMLCanvasElement | ImageBitmap | HTMLVideoElement, 
         frameNumber: number, 
         timestamp: number): Promise<DetectionResult>;
  isReady(): boolean;
  getMetadata(): EngineMetadata;
  dispose(): void;
}
```

### Detection Output Schema

```typescript
interface Detection {
  object_type: 'pothole' | 'road_crack' | 'vehicle' | 'person' | 'road_sign';
  confidence: number;  // 0.0 - 1.0
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  frame_timestamp: number;
  camera_id: string;
  bus_id: string;
  frame_number: number;
}
```

## Testing the CV Engine

### Method 1: Using Generated Test Video

1. Open the application and navigate to the "CV Engine" tab
2. Click "Generate Test Video (with synthetic defects)"
3. Download the test video (contains 5 synthetic road defects)
4. Upload the downloaded video using the file input
5. Click "Start Processing"
6. Observe real-time detection results with bounding boxes

### Method 2: Using Real Dashcam Footage

1. Obtain dashcam video footage (MP4, WebM, or other browser-supported format)
2. Upload via the file input in the "CV Engine" tab
3. Click "Start Processing"
4. Review detection results

### Expected Performance

**Browser-based processing:**
- Average FPS: 5-15 (depends on video resolution and browser)
- Inference time: 50-200ms per frame
- Memory usage: ~100-300MB

**Note:** Performance varies significantly based on:
- Video resolution (640x480 vs 1920x1080)
- Browser capabilities
- System hardware
- Number of defects in frame

## Production Requirements

### For YOLO Integration

To replace the image processing detector with YOLO:

1. **Model Selection:**
   - YOLOv8-nano or YOLOv8-small for real-time performance
   - Train on road defect dataset (potholes, cracks, etc.)
   - Recommended dataset: RDD2022 (Road Damage Detection Dataset)

2. **Model Conversion:**
   ```bash
   # Export YOLO model to ONNX
   yolo export model=yolov8n.pt format=onnx imgsz=640
   
   # Or to TensorFlow.js
   yolo export model=yolov8n.pt format=tfjs
   ```

3. **Browser Integration Options:**

   **Option A: ONNX Runtime Web**
   ```bash
   npm install onnxruntime-web
   ```
   ```typescript
   import * as ort from 'onnxruntime-web';
   
   const session = await ort.InferenceSession.create('./model.onnx');
   const tensor = new ort.Tensor('float32', imageData, [1, 3, 640, 640]);
   const results = await session.run({ images: tensor });
   ```

   **Option B: TensorFlow.js**
   ```bash
   npm install @tensorflow/tfjs
   ```
   ```typescript
   import * as tf from '@tensorflow/tfjs';
   
   const model = await tf.loadGraphModel('./model.json');
   const tensor = tf.tensor4d(imageData, [1, 640, 640, 3]);
   const predictions = await model.predict(tensor);
   ```

4. **Implementation Steps:**
   - Create `YOLODetector` class implementing `DetectionEngine`
   - Load model in `initialize()`
   - Preprocess frames (resize, normalize)
   - Run inference
   - Post-process outputs (NMS, confidence filtering)
   - Return `DetectionResult`

### For Server-Side Processing

For higher accuracy and performance:

1. **Python Backend with YOLO:**
   ```python
   from ultralytics import YOLO
   
   model = YOLO('yolov8n.pt')
   results = model(frame, conf=0.5)
   
   detections = []
   for box in results[0].boxes:
       detections.append({
           'object_type': model.names[int(box.cls)],
           'confidence': float(box.conf),
           'bbox': box.xyxy[0].tolist()
       })
   ```

2. **API Integration:**
   - Send frames to Python backend via REST/WebSocket
   - Receive detection results
   - Update `DetectionEngine` interface to support remote inference

## Configuration

### DetectionEngineConfig

```typescript
interface DetectionEngineConfig {
  confidence_threshold: number;  // Minimum confidence (0.0 - 1.0)
  frame_skip: number;            // Process every Nth frame (0 = every frame)
  camera_id: string;             // Camera identifier
  bus_id: string;                // Bus identifier
  max_detections_per_frame?: number;  // Limit detections per frame
}
```

### Recommended Settings

**For testing:**
```typescript
{
  confidence_threshold: 0.3,
  frame_skip: 0,
  camera_id: 'CAM-TEST-01',
  bus_id: 'BUS-TEST-001',
  max_detections_per_frame: 10
}
```

**For production:**
```typescript
{
  confidence_threshold: 0.6,
  frame_skip: 2,  // Process every 3rd frame
  camera_id: 'CAM-FRONT-01',
  bus_id: 'BUS-KA01-001',
  max_detections_per_frame: 5
}
```

## Performance Optimization

### Frame Sampling

Skip frames to reduce processing load:
```typescript
const detector = new RoadDefectDetector({
  frame_skip: 2,  // Process every 3rd frame
  // ...
});
```

### Resolution Scaling

Process at lower resolution for speed:
```typescript
// In RoadDefectDetector
this.canvas.width = 320;  // Half resolution
this.canvas.height = 240;
```

### Web Workers

Move processing to web worker for non-blocking UI:
```typescript
const worker = new Worker('./cv-worker.ts');
worker.postMessage({ frame: imageData, frameNumber: 123 });
worker.onmessage = (e) => {
  const result = e.data as DetectionResult;
};
```

## Error Handling

The CV engine includes comprehensive error handling:

1. **Initialization Errors:**
   - Canvas context creation failure
   - Model loading failure (for ML models)

2. **Processing Errors:**
   - Invalid frame dimensions
   - Inference failures
   - Memory allocation errors

3. **Logging:**
   - All errors are logged to console
   - Error callback in VideoPipeline
   - UI error display in CVDemo component

## Future Enhancements

1. **Multi-class Detection:**
   - Vehicles, pedestrians, road signs
   - Traffic congestion detection
   - Waterlogging detection

2. **Tracking:**
   - ByteTrack integration for object tracking
   - Temporal consistency across frames

3. **Edge Deployment:**
   - TensorFlow Lite for mobile
   - TensorRT for NVIDIA Jetson
   - OpenVINO for Intel hardware

4. **Model Ensemble:**
   - Combine multiple models for better accuracy
   - Specialized models for different defect types

## References

- [YOLOv8 Documentation](https://docs.ultralytics.com/)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript.html)
- [TensorFlow.js](https://www.tensorflow.org/js)
- [RDD2022 Dataset](https://github.com/sekilab/RoadDamageDetector)
- [Road Damage Detection Challenge](https://rdd2022.sekilab.global/)
