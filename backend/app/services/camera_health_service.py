"""
Camera Health & Image Quality Assessment Service.
Calculates real-time optics metrics: Laplacian blur variance, exposure balance, lens obstruction, and night condition detection.
"""

import cv2
import numpy as np
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class CameraHealthService:
    """Evaluates optical feed quality to prevent low-confidence detection noise"""

    BLUR_THRESHOLD = 60.0         # Laplacian variance below this is blurry
    NIGHT_THRESHOLD = 45.0        # Mean brightness below this is low-light
    OVEREXPOSURE_THRESHOLD = 220  # Mean brightness above this is washed out
    OBSTRUCTION_VAR_MIN = 12.0    # Near zero variance indicates lens blocked/covered

    @classmethod
    def evaluate_frame_quality(cls, frame_bgr: np.ndarray) -> Dict[str, any]:
        """
        Analyze a single video frame and return structured health indicators.
        """
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        # 1. Blur detection using Laplacian variance
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        blur_score = float(laplacian.var())

        # 2. Exposure & brightness metrics
        mean_brightness = float(np.mean(gray))
        std_brightness = float(np.std(gray))

        # 3. Obstruction check (very low standard deviation across frame)
        is_blocked = std_brightness < cls.OBSTRUCTION_VAR_MIN

        # 4. Status determination
        reasons = []
        if is_blocked:
            status = "BLOCKED"
            reasons.append("Lens surface completely obstructed or camera disconnected")
            data_quality = "UNUSABLE"
        elif mean_brightness < cls.NIGHT_THRESHOLD:
            status = "LOW_LIGHT"
            reasons.append(f"Sub-optimal illumination ({mean_brightness:.1f} < {cls.NIGHT_THRESHOLD})")
            data_quality = "DEGRADED"
        elif mean_brightness > cls.OVEREXPOSURE_THRESHOLD:
            status = "DEGRADED"
            reasons.append(f"Excessive road glare or direct sunlight overexposure ({mean_brightness:.1f})")
            data_quality = "DEGRADED"
        elif blur_score < cls.BLUR_THRESHOLD:
            status = "DEGRADED"
            reasons.append(f"Motion blur or out-of-focus optics ({blur_score:.1f} < {cls.BLUR_THRESHOLD})")
            data_quality = "LOW"
        else:
            status = "NORMAL"
            reasons.append("Optics sharp, illumination within normal range")
            data_quality = "HIGH"

        return {
            "status": status,
            "data_quality": data_quality,
            "blur_laplacian_variance": round(blur_score, 2),
            "mean_brightness": round(mean_brightness, 2),
            "contrast_std": round(std_brightness, 2),
            "resolution": f"{w}x{h}",
            "reasons": reasons,
            "can_ingest_high_confidence": status == "NORMAL"
        }
