from __future__ import annotations

from typing import Dict, List

from vision_worker.reference.detector.vehicle_detector import VehicleDetection, VehicleDetector


class VehicleTracker:
    def __init__(self, detector: VehicleDetector):
        self.detector = detector
        self.names: Dict[int, str] = detector.model.names

    def update(self, frame) -> List[VehicleDetection]:
        results = self.detector.track_frame(frame)
        if not results:
            return []

        result = results[0]
        boxes = result.boxes
        if boxes is None or boxes.xyxy is None:
            return []

        detections: List[VehicleDetection] = []
        ids = boxes.id

        for idx, xyxy in enumerate(boxes.xyxy.cpu().numpy()):
            if ids is None:
                continue

            track_id = int(ids[idx].item())
            class_id = int(boxes.cls[idx].item())
            confidence = float(boxes.conf[idx].item())
            x1, y1, x2, y2 = [int(round(value)) for value in xyxy]
            cx = int(round((x1 + x2) / 2))
            cy = int(round((y1 + y2) / 2))
            class_name = self.names.get(class_id, str(class_id))

            detections.append(
                VehicleDetection(
                    class_id=class_id,
                    class_name=class_name,
                    confidence=confidence,
                    bbox=(x1, y1, x2, y2),
                    center=(cx, cy),
                    track_id=track_id,
                )
            )

        return detections
