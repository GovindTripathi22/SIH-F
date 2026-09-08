import { useState, useRef, useEffect } from 'react';
import { RoadDefectDetector } from '../cv/RoadDefectDetector';
import { Detection, DetectionResult } from '../cv/types';
import { generateAndDownloadTestVideo } from '../cv/TestVideoGenerator';

interface DetectionStats {
  totalFrames: number;
  processedFrames: number;
  totalDetections: number;
  avgInferenceMs: number;
  avgFps: number;
  maxFps: number;
  minFps: number;
}

export function CVDemo() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [stats, setStats] = useState<DetectionStats>({
    totalFrames: 0,
    processedFrames: 0,
    totalDetections: 0,
    avgInferenceMs: 0,
    avgFps: 0,
    maxFps: 0,
    minFps: Infinity
  });
  const [engineInfo, setEngineInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<RoadDefectDetector | null>(null);
  const animationFrameRef = useRef<number>();
  const frameCountRef = useRef(0);
  const inferenceTimesRef = useRef<number[]>([]);
  const fpsValuesRef = useRef<number[]>([]);

  // Initialize detector
  useEffect(() => {
    const initDetector = async () => {
      try {
        const detector = new RoadDefectDetector({
          confidence_threshold: 0.3,
          frame_skip: 0,
          camera_id: 'CAM-FRONT-01',
          bus_id: 'BUS-SIM-001',
          max_detections_per_frame: 10
        });

        await detector.initialize();
        detectorRef.current = detector;
        setEngineInfo(detector.getMetadata());
      } catch (err) {
        setError(`Failed to initialize detector: ${err}`);
      }
    };

    initDetector();

    return () => {
      detectorRef.current?.dispose();
    };
  }, []);

  // Handle video upload
  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setDetections([]);
      setStats({
        totalFrames: 0,
        processedFrames: 0,
        totalDetections: 0,
        avgInferenceMs: 0,
        avgFps: 0,
        maxFps: 0,
        minFps: Infinity
      });
      frameCountRef.current = 0;
      inferenceTimesRef.current = [];
      fpsValuesRef.current = [];
    }
  };

  // Process video frame by frame
  const startProcessing = async () => {
    if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current || !detectorRef.current) {
      setError('Video or detector not ready');
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    setError(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');

    if (!ctx || !overlayCtx) {
      setError('Failed to get canvas context');
      setIsProcessing(false);
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    overlayCanvas.width = video.videoWidth;
    overlayCanvas.height = video.videoHeight;

    video.currentTime = 0;
    await new Promise(resolve => {
      video.onseeked = resolve;
    });

    const processNextFrame = async () => {
      if (!isProcessing || video.ended) {
        setIsProcessing(false);
        return;
      }

      if (isPaused) {
        animationFrameRef.current = requestAnimationFrame(processNextFrame);
        return;
      }

      try {
        // Draw current frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Run detection
        const startTime = performance.now();
        const result = await detectorRef.current!.detect(canvas, frameCountRef.current, video.currentTime);
        const inferenceTime = performance.now() - startTime;

        // Update stats
        frameCountRef.current++;
        inferenceTimesRef.current.push(inferenceTime);
        if (result.fps > 0) {
          fpsValuesRef.current.push(result.fps);
        }

        const avgInference = inferenceTimesRef.current.reduce((a, b) => a + b, 0) / inferenceTimesRef.current.length;
        const avgFps = fpsValuesRef.current.length > 0 
          ? fpsValuesRef.current.reduce((a, b) => a + b, 0) / fpsValuesRef.current.length
          : 0;
        const maxFps = fpsValuesRef.current.length > 0 ? Math.max(...fpsValuesRef.current) : 0;
        const minFps = fpsValuesRef.current.length > 0 ? Math.min(...fpsValuesRef.current) : 0;

        setStats(prev => ({
          totalFrames: frameCountRef.current,
          processedFrames: prev.processedFrames + 1,
          totalDetections: prev.totalDetections + result.detections.length,
          avgInferenceMs: avgInference,
          avgFps: avgFps,
          maxFps: maxFps,
          minFps: minFps
        }));

        setCurrentFrame(frameCountRef.current);

        // Draw detection overlays
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        result.detections.forEach(detection => {
          const { bbox, object_type, confidence } = detection;
          
          // Draw bounding box
          overlayCtx.strokeStyle = object_type === 'pothole' ? '#ef4444' : '#f97316';
          overlayCtx.lineWidth = 3;
          overlayCtx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

          // Draw label background
          const label = `${object_type} ${(confidence * 100).toFixed(1)}%`;
          overlayCtx.font = 'bold 16px Arial';
          const textWidth = overlayCtx.measureText(label).width;
          
          overlayCtx.fillStyle = object_type === 'pothole' ? '#ef4444' : '#f97316';
          overlayCtx.fillRect(bbox.x, bbox.y - 25, textWidth + 10, 25);
          
          // Draw label text
          overlayCtx.fillStyle = '#ffffff';
          overlayCtx.fillText(label, bbox.x + 5, bbox.y - 7);
        });

        // Add new detections to list
        if (result.detections.length > 0) {
          setDetections(prev => [...prev, ...result.detections].slice(-50)); // Keep last 50
        }

        // Move to next frame
        video.currentTime += 1 / 30; // 30 FPS
        
        await new Promise(resolve => {
          video.onseeked = resolve;
        });

        // Continue processing
        animationFrameRef.current = requestAnimationFrame(processNextFrame);

      } catch (err) {
        setError(`Processing error: ${err}`);
        setIsProcessing(false);
      }
    };

    processNextFrame();
  };

  const pauseProcessing = () => {
    setIsPaused(!isPaused);
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    setIsPaused(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Computer Vision Engine Demo</h1>
        <p className="text-gray-400 mb-6">
          Road defect detection using image processing techniques
        </p>

        {/* Engine Info */}
        {engineInfo && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-semibold mb-3">Engine Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Name:</span>
                <div className="font-mono">{engineInfo.name}</div>
              </div>
              <div>
                <span className="text-gray-400">Version:</span>
                <div className="font-mono">{engineInfo.version}</div>
              </div>
              <div>
                <span className="text-gray-400">Type:</span>
                <div className="font-mono">{engineInfo.type}</div>
              </div>
              <div>
                <span className="text-gray-400">Input Size:</span>
                <div className="font-mono">{engineInfo.input_size.width}x{engineInfo.input_size.height}</div>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-gray-400 text-sm">Supported Classes:</span>
              <div className="flex gap-2 mt-1">
                {engineInfo.supported_classes.map((cls: string) => (
                  <span key={cls} className="bg-blue-600 px-2 py-1 rounded text-xs">
                    {cls}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Video Upload */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Video Input</h2>
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
          />
          <button
            onClick={generateAndDownloadTestVideo}
            className="mt-3 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-sm font-semibold"
          >
            <i className="fa-solid fa-download mr-2"></i>
            Generate Test Video (with synthetic defects)
          </button>
          {videoUrl && (
            <div className="mt-4">
              <video
                ref={videoRef}
                src={videoUrl}
                className="hidden"
                playsInline
                muted
              />
              <p className="text-green-400 text-sm">✓ Video loaded successfully</p>
            </div>
          )}
        </div>

        {/* Controls */}
        {videoUrl && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Controls</h2>
            <div className="flex gap-4">
              {!isProcessing ? (
                <button
                  onClick={startProcessing}
                  className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-semibold"
                >
                  Start Processing
                </button>
              ) : (
                <>
                  <button
                    onClick={pauseProcessing}
                    className="bg-yellow-600 hover:bg-yellow-700 px-6 py-2 rounded font-semibold"
                  >
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={stopProcessing}
                    className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded font-semibold"
                  >
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Video Display */}
        {videoUrl && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Video Output</h2>
            <div className="relative inline-block">
              <canvas
                ref={canvasRef}
                className="border border-gray-700 rounded"
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 border border-gray-700 rounded pointer-events-none"
              />
            </div>
            <div className="mt-4 text-sm text-gray-400">
              Frame: {currentFrame} | Status: {isProcessing ? (isPaused ? 'Paused' : 'Processing') : 'Ready'}
            </div>
          </div>
        )}

        {/* Statistics */}
        {stats.processedFrames > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Performance Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 rounded p-4">
                <div className="text-gray-400 text-sm">Total Frames</div>
                <div className="text-2xl font-bold">{stats.totalFrames}</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-gray-400 text-sm">Processed Frames</div>
                <div className="text-2xl font-bold">{stats.processedFrames}</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-gray-400 text-sm">Total Detections</div>
                <div className="text-2xl font-bold text-red-400">{stats.totalDetections}</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-gray-400 text-sm">Avg Inference Time</div>
                <div className="text-2xl font-bold">{stats.avgInferenceMs.toFixed(2)} ms</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-gray-400 text-sm">Average FPS</div>
                <div className="text-2xl font-bold text-green-400">{stats.avgFps.toFixed(2)}</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-gray-400 text-sm">Max FPS</div>
                <div className="text-2xl font-bold text-blue-400">{stats.maxFps.toFixed(2)}</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-gray-400 text-sm">Min FPS</div>
                <div className="text-2xl font-bold text-yellow-400">{stats.minFps === Infinity ? 0 : stats.minFps.toFixed(2)}</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-gray-400 text-sm">Detections/Frame</div>
                <div className="text-2xl font-bold">
                  {stats.processedFrames > 0 ? (stats.totalDetections / stats.processedFrames).toFixed(2) : 0}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detection Results */}
        {detections.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Detections (Last 50)</h2>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Frame</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Confidence</th>
                    <th className="px-4 py-2 text-left">Bounding Box</th>
                    <th className="px-4 py-2 text-left">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {detections.slice().reverse().map((det, idx) => (
                    <tr key={idx} className="border-b border-gray-700">
                      <td className="px-4 py-2 font-mono">{det.frame_number}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          det.object_type === 'pothole' ? 'bg-red-600' : 'bg-orange-600'
                        }`}>
                          {det.object_type}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono">{(det.confidence * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        x:{det.bbox.x} y:{det.bbox.y} w:{det.bbox.width} h:{det.bbox.height}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{det.frame_timestamp.toFixed(3)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mt-6">
            <h3 className="text-red-200 font-semibold mb-2">Error</h3>
            <p className="text-red-100 text-sm font-mono">{error}</p>
          </div>
        )}

        {/* Important Notes */}
        <div className="bg-blue-900 border border-blue-700 rounded-lg p-4 mt-6">
          <h3 className="text-blue-200 font-semibold mb-2">Important Notes</h3>
          <ul className="text-blue-100 text-sm space-y-1 list-disc list-inside">
            <li>This demo uses image processing techniques (not deep learning) for road defect detection</li>
            <li>Detection accuracy is limited compared to YOLO or other ML models</li>
            <li>For production use, integrate YOLOv8 or similar deep learning model</li>
            <li>Performance depends on video resolution and browser capabilities</li>
            <li>The detection engine interface is designed to be easily replaced with ML models</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
