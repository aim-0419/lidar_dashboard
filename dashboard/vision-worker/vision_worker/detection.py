"""Adapter based on CV-Wrongway-Detection's YOLO/ByteTrack path."""
from pathlib import Path
from .core import Observation


class VehicleTracker:
    def __init__(self, model_path, device="cpu", confidence=0.4):
        if not Path(model_path).is_file():
            raise ValueError("Local model weights required; automatic downloads disabled")
        from ultralytics import YOLO
        self.model = YOLO(model_path)
        self.device = device
        self.confidence = confidence

    def update(self, frame):
        results = self.model.track(frame, persist=True, tracker="bytetrack.yaml",
                                   classes=[2, 3, 5, 7], conf=self.confidence,
                                   device=self.device, verbose=False)
        output = []
        for result in results:
            boxes = result.boxes
            if boxes is None or boxes.id is None:
                continue
            for box, track in zip(boxes.xyxy.cpu().tolist(), boxes.id.cpu().tolist()):
                x1, y1, x2, y2 = box
                output.append(Observation(str(int(track)), ((x1 + x2) / 2, y2)))
        return output
