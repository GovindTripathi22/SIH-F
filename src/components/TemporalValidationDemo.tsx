import { useState, useEffect, useRef } from 'react';
import { Detection } from '../cv/types';
import { TemporalValidator, TemporalValidationConfig, ValidationResult } from '../cv/temporal';

export default function TemporalValidationDemo() {
  const [config, setConfig] = useState<TemporalValidationConfig>({
    min_persistence_frames: 3,
    iou_threshold: 0.5,
    max_disappearance_frames: 2,
    confidence_threshold: 0.6,
    max_track_age_frames: 30
  });

  const [validator, setValidator] = useState<TemporalValidator>(new TemporalValidator(config));
  const [currentFrame, setCurrentFrame] = useState(0);
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [detectionSequence, setDetectionSequence] = useState<Detection[][]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate synthetic detection sequence for demo
  useEffect(() => {
    const sequence: Detection[][] = [];
    
    // Frame 0-2: Stable pothole detection (should be validated)
    for (let i = 0; i < 3; i++) {
      sequence.push([
        {
          object_type: 'pothole',
          confidence: 0.85,
          bbox: { x: 100, y: 150, width: 80, height: 60 },
          frame_timestamp: i * 0.033,
          camera_id: 'CAM-01',
          bus_id: 'BUS-01',
          frame_number: i
        }
      ]);
    }

    // Frame 3-5: Unstable detection (appears and disappears - should be rejected)
    sequence.push([
      {
        object_type: 'pothole',
        confidence: 0.7,
        bbox: { x: 300, y: 200, width: 70, height: 50 },
        frame_timestamp: 3 * 0.033,
        camera_id: 'CAM-01',
        bus_id: 'BUS-01',
        frame_number: 3
      }
    ]);
    sequence.push([]); // Frame 4: disappears
    sequence.push([
      {
        object_type: 'pothole',
        confidence: 0.72,
        bbox: { x: 310, y: 205, width: 72, height: 52 },
        frame_timestamp: 5 * 0.033,
        camera_id: 'CAM-01',
        bus_id: 'BUS-01',
        frame_number: 5
      }
    ]);

    // Frame 6-10: Another stable detection (should be validated)
    for (let i = 6; i < 11; i++) {
      sequence.push([
        {
          object_type: 'road_crack',
          confidence: 0.78,
          bbox: { x: 200, y: 100, width: 120, height: 40 },
          frame_timestamp: i * 0.033,
          camera_id: 'CAM-01',
          bus_id: 'BUS-01',
          frame_number: i
        }
      ]);
    }

    // Frame 11-12: Low confidence detection (should be rejected)
    for (let i = 11; i < 13; i++) {
      sequence.push([
        {
          object_type: 'pothole',
          confidence: 0.45,
          bbox: { x: 400, y: 250, width: 60, height: 45 },
          frame_timestamp: i * 0.033,
          camera_id: 'CAM-01',
          bus_id: 'BUS-01',
          frame_number: i
        }
      ]);
    }

    // Frame 13-15: Multiple detections in same frame
    for (let i = 13; i < 16; i++) {
      sequence.push([
        {
          object_type: 'pothole',
          confidence: 0.88,
          bbox: { x: 150, y: 180, width: 75, height: 55 },
          frame_timestamp: i * 0.033,
          camera_id: 'CAM-01',
          bus_id: 'BUS-01',
          frame_number: i
        },
        {
          object_type: 'road_crack',
          confidence: 0.82,
          bbox: { x: 350, y: 120, width: 100, height: 35 },
          frame_timestamp: i * 0.033,
          camera_id: 'CAM-01',
          bus_id: 'BUS-01',
          frame_number: i
        }
      ]);
    }

    setDetectionSequence(sequence);
  }, []);

  // Process frames when running
  useEffect(() => {
    if (isRunning && currentFrame < detectionSequence.length) {
      timeoutRef.current = setTimeout(() => {
        const detections = detectionSequence[currentFrame];
        const result = validator.processFrame(detections, currentFrame);
        
        setValidationResults(result);
        setCurrentFrame(prev => prev + 1);
      }, 500); // 500ms per frame for demo
    } else if (currentFrame >= detectionSequence.length) {
      setIsRunning(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isRunning, currentFrame, detectionSequence, validator]);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentFrame(0);
    setValidationResults(null);
    const newValidator = new TemporalValidator(config);
    setValidator(newValidator);
  };

  const handleConfigChange = (key: keyof TemporalValidationConfig, value: number) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    handleReset();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Temporal Validation Demo</h1>
        <p className="text-gray-400 mb-6">
          Track detections across frames to validate consistency and filter false positives
        </p>

        {/* Configuration Panel */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Validation Parameters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Min Persistence Frames: {config.min_persistence_frames}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={config.min_persistence_frames}
                onChange={(e) => handleConfigChange('min_persistence_frames', parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">
                Minimum frames a detection must appear to be validated
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                IoU Threshold: {config.iou_threshold.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.iou_threshold * 100}
                onChange={(e) => handleConfigChange('iou_threshold', parseInt(e.target.value) / 100)}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">
                Intersection over Union threshold for matching detections
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Max Disappearance: {config.max_disappearance_frames}
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={config.max_disappearance_frames}
                onChange={(e) => handleConfigChange('max_disappearance_frames', parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">
                Max frames a detection can disappear before track is lost
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Confidence Threshold: {(config.confidence_threshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.confidence_threshold * 100}
                onChange={(e) => handleConfigChange('confidence_threshold', parseInt(e.target.value) / 100)}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">
                Minimum average confidence for validation
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Max Track Age: {config.max_track_age_frames}
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={config.max_track_age_frames}
                onChange={(e) => handleConfigChange('max_track_age_frames', parseInt(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">
                Max age of track before cleanup
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex gap-4">
            <button
              onClick={handleStart}
              disabled={isRunning || currentFrame >= detectionSequence.length}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium"
            >
              Start
            </button>
            <button
              onClick={handlePause}
              disabled={!isRunning}
              className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium"
            >
              Pause
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded font-medium"
            >
              Reset
            </button>
          </div>
          <div className="mt-4 text-sm text-gray-400">
            Frame: {currentFrame} / {detectionSequence.length}
          </div>
        </div>

        {/* Metrics */}
        {validationResults && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 rounded p-4">
                <div className="text-2xl font-bold text-blue-400">
                  {validationResults.metrics.total_raw_detections}
                </div>
                <div className="text-sm text-gray-400">Raw Detections</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-2xl font-bold text-green-400">
                  {validationResults.metrics.total_validated_detections}
                </div>
                <div className="text-sm text-gray-400">Validated</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-2xl font-bold text-red-400">
                  {validationResults.metrics.total_rejected_detections}
                </div>
                <div className="text-sm text-gray-400">Rejected</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-2xl font-bold text-purple-400">
                  {validationResults.metrics.active_track_count}
                </div>
                <div className="text-sm text-gray-400">Active Tracks</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-2xl font-bold text-cyan-400">
                  {(validationResults.metrics.validation_rate * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-400">Validation Rate</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-2xl font-bold text-orange-400">
                  {(validationResults.metrics.rejection_rate * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-400">Rejection Rate</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-2xl font-bold text-pink-400">
                  {validationResults.metrics.avg_persistence.toFixed(1)}
                </div>
                <div className="text-sm text-gray-400">Avg Persistence</div>
              </div>
              <div className="bg-gray-700 rounded p-4">
                <div className="text-2xl font-bold text-indigo-400">
                  {(validationResults.metrics.avg_validation_score * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-400">Avg Validation Score</div>
              </div>
            </div>
          </div>
        )}

        {/* Active Tracks */}
        {validationResults && validationResults.active_tracks.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Active Tracks</h2>
            <div className="space-y-3">
              {validationResults.active_tracks.map((track) => (
                <div
                  key={track.track_id}
                  className={`border rounded-lg p-4 ${
                    track.is_validated ? 'border-green-500 bg-green-500/10' : 'border-gray-600 bg-gray-700/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-mono text-sm font-bold">{track.track_id}</div>
                      <div className="text-sm text-gray-400">
                        Type: {track.detection.object_type} | Confidence: {(track.detection.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                    {track.is_validated && (
                      <div className="px-3 py-1 bg-green-600 rounded text-sm font-medium">
                        Validated ({(track.validation_score * 100).toFixed(1)}%)
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Frames:</span> {track.frame_count}
                    </div>
                    <div>
                      <span className="text-gray-400">First:</span> {track.first_seen_frame}
                    </div>
                    <div>
                      <span className="text-gray-400">Last:</span> {track.last_seen_frame}
                    </div>
                    <div>
                      <span className="text-gray-400">BBox:</span> {track.detection.bbox.x},{track.detection.bbox.y}
                    </div>
                  </div>
                  {track.rejection_reason && (
                    <div className="mt-2 text-sm text-red-400">
                      Rejected: {track.rejection_reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Candidates */}
        {validator.getEventCandidates().length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Event Candidates</h2>
            <div className="space-y-3">
              {validator.getEventCandidates().map((candidate) => (
                <div
                  key={candidate.event_id}
                  className="border border-blue-500 bg-blue-500/10 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-mono text-sm font-bold">{candidate.event_id}</div>
                      <div className="text-sm text-gray-400">
                        Track: {candidate.track_id} | Type: {candidate.detection.object_type}
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-blue-600 rounded text-sm font-medium">
                      Score: {(candidate.validation_score * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Persistence:</span> {candidate.persistence_frames} frames
                    </div>
                    <div>
                      <span className="text-gray-400">Confidence:</span> {(candidate.detection.confidence * 100).toFixed(1)}%
                    </div>
                    <div>
                      <span className="text-gray-400">Status:</span> {candidate.status}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    Frame References: [{candidate.frame_references.join(', ')}]
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Frame Detections */}
        {validationResults && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Frame {currentFrame - 1} Detections</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Raw Detections</h3>
                <div className="space-y-2">
                  {validationResults.raw_detections.map((det, idx) => (
                    <div key={idx} className="bg-gray-700 rounded p-2 text-sm">
                      <div className="font-mono">Frame {det.frame_number}</div>
                      <div className="text-xs text-gray-400">
                        {det.object_type} | {(det.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                  {validationResults.raw_detections.length === 0 && (
                    <div className="text-sm text-gray-500">No detections</div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-green-400 mb-2">Validated</h3>
                <div className="space-y-2">
                  {validationResults.validated_detections.map((track) => (
                    <div key={track.track_id} className="bg-green-500/20 border border-green-500 rounded p-2 text-sm">
                      <div className="font-mono">{track.track_id}</div>
                      <div className="text-xs text-gray-400">
                        {track.detection.object_type} | {(track.validation_score * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                  {validationResults.validated_detections.length === 0 && (
                    <div className="text-sm text-gray-500">None</div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-red-400 mb-2">Rejected</h3>
                <div className="space-y-2">
                  {validationResults.rejected_detections.map((track) => (
                    <div key={track.track_id} className="bg-red-500/20 border border-red-500 rounded p-2 text-sm">
                      <div className="font-mono">{track.track_id}</div>
                      <div className="text-xs text-gray-400">
                        {track.rejection_reason || 'Unknown'}
                      </div>
                    </div>
                  ))}
                  {validationResults.rejected_detections.length === 0 && (
                    <div className="text-sm text-gray-500">None</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
