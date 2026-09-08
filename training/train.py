"""
UrbanPulse — Road Defect Model Training Pipeline
Fine-tunes YOLOv8 on Road Damage Datasets (RDD2022 / Roboflow Road Defect Benchmarks).
"""

import os
import argparse
import logging
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def train_road_defect_model(
    data_yaml: str = "datasets/data.yaml",
    base_model: str = "yolov8n.pt",
    epochs: int = 50,
    imgsz: int = 640,
    batch_size: int = 16,
    project: str = "training/runs",
    name: str = "rdd_yolov8n"
):
    """
    Train or fine-tune YOLOv8 on genuine road-damage annotations.
    Classes: POTHOLE, CRACK, PATCH, MANHOLE, DRAINAGE
    """
    logger.info(f"Initializing YOLOv8 training with base model: {base_model}")
    logger.info(f"Data configuration: {data_yaml}")
    
    if not os.path.exists(data_yaml):
        raise FileNotFoundError(f"Dataset config {data_yaml} not found.")

    model = YOLO(base_model)
    
    # Execute training
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch_size,
        project=project,
        name=name,
        device="cpu",  # or '0' if CUDA available
        verbose=True,
        plots=True,
        save=True
    )
    
    logger.info(f"Training completed! Results saved to {project}/{name}")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train UrbanPulse Road Defect YOLOv8 Model")
    parser.add_argument("--data", default="datasets/data.yaml", help="Path to data.yaml")
    parser.add_argument("--base", default="yolov8n.pt", help="Base model checkpoint")
    parser.add_argument("--epochs", type=int, default=10, help="Training epochs")
    parser.add_argument("--imgsz", type=int, default=640, help="Input image size")
    parser.add_argument("--batch", type=int, default=8, help="Batch size")
    args = parser.parse_args()

    train_road_defect_model(
        data_yaml=args.data,
        base_model=args.base,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch_size=args.batch
    )
