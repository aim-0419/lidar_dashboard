from __future__ import annotations

from typing import Iterable, Mapping, Sequence

import cv2
import numpy as np

from vision_worker.reference.detector.vehicle_detector import VehicleDetection
from vision_worker.reference.wrongway.detector import VehicleState, WrongWayResult
from vision_worker.reference.wrongway.roi import ROI


GREEN = (50, 220, 80)
YELLOW = (0, 220, 255)
RED = (40, 40, 255)
BLUE = (255, 120, 40)
WHITE = (245, 245, 245)
BLACK = (0, 0, 0)
GRAY = (140, 140, 140)


def draw_rois(frame, rois: Iterable[ROI]) -> None:
    for roi in rois:
        cv2.polylines(frame, [roi.polygon], isClosed=True, color=BLUE, thickness=2)
        center = roi.center()
        direction = roi.normal_direction
        end = (int(center[0] + direction[0] * 55), int(center[1] + direction[1] * 55))
        cv2.arrowedLine(frame, center, end, BLUE, 2, tipLength=0.25)
        draw_label(frame, roi.name, (center[0] + 8, center[1] - 8), BLUE)


def draw_vehicle(
    frame,
    detection: VehicleDetection,
    trajectory: Sequence[tuple[int, int]],
    result: WrongWayResult,
) -> None:
    is_wrong = result.state == VehicleState.WRONG_WAY
    is_candidate = result.state == VehicleState.WRONG_WAY_CANDIDATE
    color = RED if is_wrong else YELLOW if is_candidate else GREEN
    thickness = 4 if is_wrong else 2

    x1, y1, x2, y2 = detection.bbox
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

    label = f"{detection.class_name.upper()} {detection.track_id}"
    if is_wrong:
        label = f"WRONG WAY | {label}"
    draw_label(frame, label, (x1, max(20, y1 - 8)), color)

    if len(trajectory) >= 2:
        pts = np.array(trajectory, dtype=np.int32).reshape((-1, 1, 2))
        cv2.polylines(frame, [pts], isClosed=False, color=color, thickness=3 if is_wrong else 2)


def draw_hud(frame, fps: float, wrong_way_results: Mapping[int, WrongWayResult]) -> None:
    draw_label(frame, f"FPS: {fps:.1f}", (12, 28), WHITE, bg=BLACK)
    wrong_ids = [
        track_id
        for track_id, result in wrong_way_results.items()
        if result.state == VehicleState.WRONG_WAY
    ]
    if wrong_ids:
        message = "!!! WRONG WAY DETECTED !!!  VEHICLE ID: " + ", ".join(map(str, wrong_ids))
        cv2.rectangle(frame, (0, 42), (frame.shape[1], 86), RED, -1)
        cv2.putText(frame, message, (14, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.85, WHITE, 2, cv2.LINE_AA)


def draw_label(frame, text: str, origin: tuple[int, int], fg, bg=BLACK) -> None:
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.55
    thickness = 1
    (width, height), baseline = cv2.getTextSize(text, font, scale, thickness)
    x, y = origin
    x = max(0, min(x, frame.shape[1] - width - 8))
    y = max(height + 6, min(y, frame.shape[0] - baseline - 6))
    cv2.rectangle(frame, (x - 4, y - height - 5), (x + width + 4, y + baseline + 4), bg, -1)
    cv2.putText(frame, text, (x, y), font, scale, fg, thickness, cv2.LINE_AA)
