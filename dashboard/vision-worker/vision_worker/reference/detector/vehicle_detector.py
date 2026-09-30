from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class VehicleDetection:
    class_id: int
    class_name: str
    confidence: float
    bbox: Tuple[int, int, int, int]
    center: Tuple[int, int]
    track_id: Optional[int] = None


class VehicleDetector:
    def __init__(
        self,
        model_path: str,
        device: str,
        confidence: float,
        class_ids: list[int],
        imgsz: int,
        tracker_config: str,
    ):
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError(
                "ultralytics is not installed. Run: pip install -r requirements.txt"
            ) from exc

        self.model = YOLO(model_path)
        self.device = device
        self.confidence = confidence
        self.class_ids = class_ids
        self.imgsz = imgsz
        self.tracker_config = tracker_config

    def track_frame(self, frame):
        return self.model.track(
            frame,
            persist=True,
            tracker=self.tracker_config,
            conf=self.confidence,
            imgsz=self.imgsz,
            classes=self.class_ids,
            device=self.device,
            verbose=False,
        )
