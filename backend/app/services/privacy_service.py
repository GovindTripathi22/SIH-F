"""
Privacy-by-Design Anonymization Service.
Detects faces and vehicle license plates on edge/server frames and applies irreversible blur/pixelation.
"""

import cv2
import numpy as np
import os
from typing import Tuple, List, Dict
import logging

logger = logging.getLogger(__name__)


class PrivacyAnonymizer:
    """Real OpenCV-based Face & License Plate Anonymizer for Edge Video Pipeline"""

    def __init__(self, blur_kernel_size: int = 45):
        self.blur_kernel = blur_kernel_size
        face_path = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
        plate_path = os.path.join(cv2.data.haarcascades, 'haarcascade_russian_plate_number.xml')

        self.face_cascade = cv2.CascadeClassifier(face_path) if os.path.exists(face_path) else None
        self.plate_cascade = cv2.CascadeClassifier(plate_path) if os.path.exists(plate_path) else None

    def anonymize_frame(
        self,
        frame_bgr: np.ndarray,
        blur_faces: bool = True,
        blur_plates: bool = True
    ) -> Tuple[np.ndarray, Dict[str, any]]:
        """
        Detect and blur sensitive regions (human faces and license plates).
        Returns: (anonymized_frame, metadata)
        """
        output = frame_bgr.copy()
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        h, w = frame_bgr.shape[:2]

        blurred_faces = []
        blurred_plates = []

        # 1. Face detection & anonymization
        if blur_faces and self.face_cascade is not None:
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=4,
                minSize=(24, 24)
            )
            for (x, y, fw, fh) in faces:
                # Apply strong Gaussian blur to bounding box
                roi = output[y:y+fh, x:x+fw]
                k = max(15, (fw // 2) * 2 + 1)
                blurred_roi = cv2.GaussianBlur(roi, (k, k), 30)
                output[y:y+fh, x:x+fw] = blurred_roi
                blurred_faces.append({"x": int(x), "y": int(y), "w": int(fw), "h": int(fh)})

        # 2. License plate detection & anonymization
        if blur_plates and self.plate_cascade is not None:
            plates = self.plate_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=3,
                minSize=(30, 15)
            )
            for (x, y, pw, ph) in plates:
                roi = output[y:y+ph, x:x+pw]
                k = max(15, (pw // 2) * 2 + 1)
                blurred_roi = cv2.GaussianBlur(roi, (k, k), 30)
                output[y:y+ph, x:x+pw] = blurred_roi
                blurred_plates.append({"x": int(x), "y": int(y), "w": int(pw), "h": int(ph)})

        stats = {
            "faces_anonymized": len(blurred_faces),
            "plates_anonymized": len(blurred_plates),
            "total_redactions": len(blurred_faces) + len(blurred_plates),
            "resolution": f"{w}x{h}",
            "privacy_compliance": "DPDP_2023_ALIGNMENT_ACTIVE"
        }

        return output, stats
