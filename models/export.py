"""
UrbanPulse — Edge Model Export Pipeline
Exports PyTorch YOLOv8 weights to ONNX, TensorRT, or OpenVINO for low-power bus edge inference units (e.g. Raspberry Pi 5, NVIDIA Jetson Orin Nano).
"""

import os
import argparse
import logging
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def export_edge_model(
    model_path: str = "models/rdd_yolov8n.pt",
    export_format: str = "onnx",
    imgsz: int = 640,
    half: bool = False
):
    """
    Export PyTorch model to edge-optimized formats.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model path {model_path} not found.")

    logger.info(f"Loading {model_path} for export to {export_format.upper()}...")
    model = YOLO(model_path)
    
    export_path = model.export(
        format=export_format,
        imgsz=imgsz,
        half=half,
        dynamic=False,
        simplify=True
    )

    logger.info(f"Export successful! Optimized edge artifact saved to: {export_path}")
    return export_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export YOLOv8 Road Defect Model to Edge Format")
    parser.add_argument("--model", default="models/rdd_yolov8n.pt", help="Path to PyTorch checkpoint")
    parser.add_argument("--format", default="onnx", choices=["onnx", "openvino", "torchscript", "engine"], help="Export format")
    parser.add_argument("--half", action="store_true", help="FP16 quantization")
    args = parser.parse_args()

    export_edge_model(model_path=args.model, export_format=args.format, half=args.half)
