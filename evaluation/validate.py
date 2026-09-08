"""
UrbanPulse — Road Defect Model Validation Pipeline
Runs standard validation on test/val splits to measure genuine mAP@0.5, mAP@0.5:0.95, Precision, Recall, and F1.
"""

import os
import argparse
import logging
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def validate_road_defect_model(
    model_path: str = "models/rdd_yolov8n.pt",
    data_yaml: str = "datasets/data.yaml",
    imgsz: int = 640,
    batch_size: int = 16
):
    """
    Validate YOLOv8 road defect model against ground-truth validation set.
    """
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model checkpoint {model_path} does not exist.")

    logger.info(f"Loading checkpoint: {model_path}")
    model = YOLO(model_path)
    
    logger.info(f"Running validation against {data_yaml} at resolution {imgsz}...")
    metrics = model.val(
        data=data_yaml,
        imgsz=imgsz,
        batch=batch_size,
        device="cpu",
        plots=True,
        verbose=True
    )

    p = metrics.box.mp
    r = metrics.box.mr
    map50 = metrics.box.map50
    map95 = metrics.box.map
    f1 = 2 * (p * r) / max(1e-6, p + r)

    logger.info("=== EMPIRICAL VALIDATION METRICS ===")
    logger.info(f"Precision: {p:.4f}")
    logger.info(f"Recall:    {r:.4f}")
    logger.info(f"F1-Score:  {f1:.4f}")
    logger.info(f"mAP@0.5:   {map50:.4f}")
    logger.info(f"mAP@0.5:0.95: {map95:.4f}")
    
    return {
        "precision": p,
        "recall": r,
        "f1": f1,
        "map50": map50,
        "map95": map95
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate UrbanPulse Road Defect Model")
    parser.add_argument("--model", default="models/rdd_yolov8n.pt", help="Path to weights")
    parser.add_argument("--data", default="datasets/data.yaml", help="Path to data.yaml")
    args = parser.parse_args()

    validate_road_defect_model(model_path=args.model, data_yaml=args.data)
