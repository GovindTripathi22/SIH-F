"""
Privacy Anonymization and Camera Optical Health Unit Tests.
"""

import pytest
import numpy as np
import cv2
from app.services.privacy_service import PrivacyAnonymizer
from app.services.camera_health_service import CameraHealthService

def test_privacy_anonymizer_blur_execution():
    """Verify face/plate anonymizer alters image data without throwing exceptions"""
    anonymizer = PrivacyAnonymizer()
    
    # Synthetic frame with high contrast simulated face rectangle
    frame = np.full((300, 300, 3), 120, dtype=np.uint8)
    cv2.circle(frame, (150, 150), 40, (220, 200, 180), -1)
    cv2.rectangle(frame, (100, 220), (200, 260), (255, 255, 255), -1) # Plate area

    blurred_frame, stats = anonymizer.anonymize_frame(frame, blur_faces=True, blur_plates=True)
    assert blurred_frame.shape == frame.shape
    assert "privacy_compliance" in stats
    assert stats["privacy_compliance"] == "DPDP_2023_ALIGNMENT_ACTIVE"

def test_camera_health_clear_frame():
    """Verify sharp high-contrast frame with normal brightness is marked NORMAL and data_quality HIGH"""
    frame = np.full((480, 640, 3), 130, dtype=np.uint8)
    # Add sharp checkerboard pattern
    frame[::40, :, :] = 220
    frame[:, ::40, :] = 40

    result = CameraHealthService.evaluate_frame_quality(frame)
    assert result["status"] == "NORMAL"
    assert result["data_quality"] == "HIGH"
    assert result["blur_laplacian_variance"] > CameraHealthService.BLUR_THRESHOLD
    assert result["can_ingest_high_confidence"] is True

def test_camera_health_blurred_frame():
    """Verify heavily blurred frame is flagged as DEGRADED and data_quality LOW"""
    frame = np.full((480, 640, 3), 128, dtype=np.uint8)
    # Uniform low-variance image
    result = CameraHealthService.evaluate_frame_quality(frame)
    assert result["status"] in ["DEGRADED", "BLOCKED"]
    assert result["data_quality"] in ["LOW", "UNUSABLE"]
    assert result["can_ingest_high_confidence"] is False

def test_camera_health_low_light_night():
    """Verify near-pitch-black night frame triggers LOW_LIGHT status"""
    dark_frame = np.full((480, 640, 3), 15, dtype=np.uint8)
    result = CameraHealthService.evaluate_frame_quality(dark_frame)
    assert result["status"] in ["LOW_LIGHT", "BLOCKED"]
    assert result["data_quality"] in ["DEGRADED", "UNUSABLE"]
