/**
 * Test Video Generator
 * 
 * Generates synthetic test videos with road defects for testing the CV engine.
 * Creates videos with simulated potholes and road cracks.
 */

export interface TestVideoConfig {
  width: number;
  height: number;
  duration: number; // seconds
  fps: number;
  defects: Array<{
    type: 'pothole' | 'road_crack';
    x: number; // 0-1 (relative position)
    y: number; // 0-1 (relative position)
    size: number; // 0-1 (relative size)
    frame_start: number;
    frame_end: number;
  }>;
}

export class TestVideoGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: TestVideoConfig;

  constructor(config: TestVideoConfig) {
    this.config = config;
    this.canvas = document.createElement('canvas');
    this.canvas.width = config.width;
    this.canvas.height = config.height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    this.ctx = ctx;
  }

  /**
   * Generate a test video with synthetic road defects
   */
  async generateVideo(): Promise<Blob> {
    const stream = this.canvas.captureStream(this.config.fps);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 2500000
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    const recordingPromise = new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        resolve(new Blob(chunks, { type: 'video/webm' }));
      };
    });

    mediaRecorder.start();

    // Generate frames
    const totalFrames = this.config.duration * this.config.fps;
    for (let frame = 0; frame < totalFrames; frame++) {
      this.drawFrame(frame);
      await new Promise(resolve => setTimeout(resolve, 1000 / this.config.fps));
    }

    mediaRecorder.stop();
    stream.getTracks().forEach(track => track.stop());

    return recordingPromise;
  }

  private drawFrame(frameNumber: number) {
    const { width, height } = this.config;

    // Draw road background (gray asphalt)
    this.ctx.fillStyle = '#3a3a3a';
    this.ctx.fillRect(0, 0, width, height);

    // Add road texture (noise)
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const brightness = 50 + Math.random() * 20;
      this.ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
      this.ctx.fillRect(x, y, 2, 2);
    }

    // Draw road markings
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 4;
    this.ctx.setLineDash([20, 20]);
    this.ctx.beginPath();
    this.ctx.moveTo(width / 2, 0);
    this.ctx.lineTo(width / 2, height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw defects
    for (const defect of this.config.defects) {
      if (frameNumber >= defect.frame_start && frameNumber <= defect.frame_end) {
        this.drawDefect(defect);
      }
    }

    // Add frame number overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(10, 10, 150, 30);
    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = '16px monospace';
    this.ctx.fillText(`Frame: ${frameNumber}`, 20, 30);
  }

  private drawDefect(defect: TestVideoConfig['defects'][0]) {
    const { width, height } = this.config;
    const x = defect.x * width;
    const y = defect.y * height;
    const size = defect.size * Math.min(width, height);

    if (defect.type === 'pothole') {
      // Draw dark circular pothole
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, size / 2);
      gradient.addColorStop(0, '#0a0a0a');
      gradient.addColorStop(0.7, '#1a1a1a');
      gradient.addColorStop(1, '#2a2a2a');
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.ellipse(x, y, size / 2, size / 2.5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Add edge shadow
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    } else if (defect.type === 'road_crack') {
      // Draw crack pattern
      this.ctx.strokeStyle = '#1a1a1a';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      
      const segments = 8;
      for (let i = 0; i < segments; i++) {
        const segX = x + (i / segments) * size;
        const segY = y + Math.sin(i * 0.5) * (size / 4);
        if (i === 0) {
          this.ctx.moveTo(segX, segY);
        } else {
          this.ctx.lineTo(segX, segY);
        }
      }
      this.ctx.stroke();
    }
  }

  /**
   * Create a default test configuration with various defects
   */
  static createDefaultConfig(): TestVideoConfig {
    return {
      width: 640,
      height: 480,
      duration: 10, // 10 seconds
      fps: 30,
      defects: [
        {
          type: 'pothole',
          x: 0.3,
          y: 0.6,
          size: 0.15,
          frame_start: 30,
          frame_end: 90
        },
        {
          type: 'pothole',
          x: 0.7,
          y: 0.4,
          size: 0.12,
          frame_start: 60,
          frame_end: 120
        },
        {
          type: 'road_crack',
          x: 0.2,
          y: 0.3,
          size: 0.2,
          frame_start: 90,
          frame_end: 150
        },
        {
          type: 'pothole',
          x: 0.5,
          y: 0.7,
          size: 0.18,
          frame_start: 120,
          frame_end: 180
        },
        {
          type: 'road_crack',
          x: 0.6,
          y: 0.5,
          size: 0.25,
          frame_start: 150,
          frame_end: 210
        }
      ]
    };
  }
}

/**
 * Generate and download a test video
 */
export async function generateAndDownloadTestVideo(): Promise<void> {
  const config = TestVideoGenerator.createDefaultConfig();
  const generator = new TestVideoGenerator(config);
  
  console.log('Generating test video...');
  const blob = await generator.generateVideo();
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test_road_defects.webm';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('Test video downloaded successfully');
}
