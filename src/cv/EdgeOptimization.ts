/**
 * Edge Optimization Module
 * 
 * Measures and optimizes edge processing performance.
 * Key principle: Don't upload raw video - send only event metadata.
 * 
 * Pipeline:
 * RAW VIDEO → EDGE INFERENCE → EVENT FILTERING → METADATA ONLY → CENTRAL SERVER
 */

export interface EdgeMetrics {
  // Processing performance
  fps: number;
  inference_latency_ms: number;
  cpu_utilization_percent: number;
  gpu_utilization_percent: number;
  memory_usage_mb: number;
  
  // Data efficiency
  events_generated: number;
  frames_processed: number;
  frames_skipped: number;
  
  // Bandwidth
  raw_video_bandwidth_mbps: number;
  event_metadata_bandwidth_kbps: number;
  bandwidth_reduction_percent: number;
  
  // Quality
  detection_accuracy: number;
  false_positive_rate: number;
}

export interface EdgeConfig {
  device_type: 'laptop_gpu' | 'laptop_cpu' | 'edge_device' | 'jetson_nano' | 'raspberry_pi';
  target_fps: number;
  confidence_threshold: number;
  frame_skip: number;
  batch_size: number;
  enable_gpu: boolean;
  max_memory_mb: number;
}

export interface BandwidthComparison {
  raw_video_stream: {
    resolution: string;
    fps: number;
    bitrate_mbps: number;
    daily_gb: number;
  };
  event_based_transmission: {
    avg_events_per_hour: number;
    avg_event_size_kb: number;
    hourly_kb: number;
    daily_mb: number;
  };
  reduction_factor: number;
}

/**
 * Calculate bandwidth comparison between raw video and event-based transmission
 */
export function calculateBandwidthComparison(
  videoResolution: string,
  videoFps: number,
  videoBitrateMbps: number,
  avgEventsPerHour: number,
  avgEventSizeKb: number
): BandwidthComparison {
  const dailyVideoGb = (videoBitrateMbps * 1000 / 8 / 1024) * 24; // GB per day
  const dailyEventMb = (avgEventsPerHour * avgEventSizeKb * 24) / 1024; // MB per day
  const reductionFactor = (dailyVideoGb * 1024) / dailyEventMb;

  return {
    raw_video_stream: {
      resolution: videoResolution,
      fps: videoFps,
      bitrate_mbps: videoBitrateMbps,
      daily_gb: dailyVideoGb,
    },
    event_based_transmission: {
      avg_events_per_hour: avgEventsPerHour,
      avg_event_size_kb: avgEventSizeKb,
      hourly_kb: avgEventsPerHour * avgEventSizeKb,
      daily_mb: dailyEventMb,
    },
    reduction_factor: reductionFactor,
  };
}

/**
 * Get recommended edge configuration based on device type
 */
export function getRecommendedConfig(deviceType: EdgeConfig['device_type']): EdgeConfig {
  const configs: Record<EdgeConfig['device_type'], EdgeConfig> = {
    laptop_gpu: {
      device_type: 'laptop_gpu',
      target_fps: 30,
      confidence_threshold: 0.5,
      frame_skip: 0,
      batch_size: 1,
      enable_gpu: true,
      max_memory_mb: 4096,
    },
    laptop_cpu: {
      device_type: 'laptop_cpu',
      target_fps: 15,
      confidence_threshold: 0.6,
      frame_skip: 1,
      batch_size: 1,
      enable_gpu: false,
      max_memory_mb: 2048,
    },
    edge_device: {
      device_type: 'edge_device',
      target_fps: 10,
      confidence_threshold: 0.65,
      frame_skip: 2,
      batch_size: 1,
      enable_gpu: false,
      max_memory_mb: 1024,
    },
    jetson_nano: {
      device_type: 'jetson_nano',
      target_fps: 15,
      confidence_threshold: 0.55,
      frame_skip: 1,
      batch_size: 1,
      enable_gpu: true,
      max_memory_mb: 2048,
    },
    raspberry_pi: {
      device_type: 'raspberry_pi',
      target_fps: 5,
      confidence_threshold: 0.7,
      frame_skip: 5,
      batch_size: 1,
      enable_gpu: false,
      max_memory_mb: 512,
    },
  };

  return configs[deviceType];
}

/**
 * Simulate edge metrics based on configuration
 * NOTE: These are estimates based on typical performance characteristics
 */
export function estimateEdgeMetrics(config: EdgeConfig): EdgeMetrics {
  // Base metrics vary by device type
  const baseMetrics: Record<EdgeConfig['device_type'], Partial<EdgeMetrics>> = {
    laptop_gpu: {
      fps: 28,
      inference_latency_ms: 35,
      cpu_utilization_percent: 25,
      gpu_utilization_percent: 70,
      memory_usage_mb: 2800,
    },
    laptop_cpu: {
      fps: 12,
      inference_latency_ms: 80,
      cpu_utilization_percent: 65,
      gpu_utilization_percent: 0,
      memory_usage_mb: 1500,
    },
    edge_device: {
      fps: 8,
      inference_latency_ms: 120,
      cpu_utilization_percent: 80,
      gpu_utilization_percent: 0,
      memory_usage_mb: 800,
    },
    jetson_nano: {
      fps: 14,
      inference_latency_ms: 65,
      cpu_utilization_percent: 45,
      gpu_utilization_percent: 60,
      memory_usage_mb: 1800,
    },
    raspberry_pi: {
      fps: 4,
      inference_latency_ms: 250,
      cpu_utilization_percent: 90,
      gpu_utilization_percent: 0,
      memory_usage_mb: 400,
    },
  };

  const base = baseMetrics[config.device_type];

  return {
    fps: base.fps || 10,
    inference_latency_ms: base.inference_latency_ms || 100,
    cpu_utilization_percent: base.cpu_utilization_percent || 50,
    gpu_utilization_percent: base.gpu_utilization_percent || 0,
    memory_usage_mb: base.memory_usage_mb || 1000,
    events_generated: Math.floor(config.target_fps * 0.1), // ~10% of frames produce events
    frames_processed: config.target_fps * 60, // per minute
    frames_skipped: config.frame_skip > 0 ? config.target_fps * 60 * (config.frame_skip / (config.frame_skip + 1)) : 0,
    raw_video_bandwidth_mbps: 4.0, // Typical dashcam
    event_metadata_bandwidth_kbps: 2.5, // ~2.5 KB per event at 1 event/sec
    bandwidth_reduction_percent: 99.9, // Event metadata vs raw video
    detection_accuracy: config.confidence_threshold > 0.6 ? 0.85 : 0.75,
    false_positive_rate: config.confidence_threshold > 0.6 ? 0.05 : 0.15,
  };
}

/**
 * Document edge deployment limitations
 */
export const EDGE_LIMITATIONS = {
  accuracy: 'Lower accuracy than cloud-based processing due to model size constraints',
  latency: 'Inference latency varies significantly by device (35ms GPU to 250ms RPi)',
  memory: 'Large models may not fit on edge devices with limited RAM',
  connectivity: 'Events are buffered locally during network outages',
  model_size: 'Edge models are typically 10-50MB vs 200MB+ for full models',
  updates: 'Model updates require OTA deployment mechanism',
  power: 'Continuous inference consumes significant power on battery devices',
  environment: 'Performance degrades in extreme temperatures',
};
