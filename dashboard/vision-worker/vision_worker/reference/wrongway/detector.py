from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from math import hypot
from typing import Dict, Optional, Tuple

from vision_worker.reference.wrongway.roi import ROI


Vector = Tuple[float, float]


class VehicleState(str, Enum):
    NORMAL = "NORMAL"
    WRONG_WAY_CANDIDATE = "WRONG_WAY_CANDIDATE"
    WRONG_WAY = "WRONG_WAY"


@dataclass
class WrongWayResult:
    state: VehicleState
    roi_name: Optional[str]
    cosine: Optional[float]
    event_started: bool = False


@dataclass
class VehicleStatus:
    state: VehicleState = VehicleState.NORMAL
    reverse_frames: int = 0
    event_logged: bool = False


class WrongWayDetector:
    def __init__(self, reverse_threshold: float, confirm_frames: int):
        self.reverse_threshold = reverse_threshold
        self.confirm_frames = confirm_frames
        self.statuses: Dict[int, VehicleStatus] = {}

    def update(self, track_id: int, movement: Optional[Vector], roi: Optional[ROI]) -> WrongWayResult:
        status = self.statuses.setdefault(track_id, VehicleStatus())
        if movement is None or roi is None:
            status.reverse_frames = 0
            if status.state != VehicleState.WRONG_WAY:
                status.state = VehicleState.NORMAL
            return WrongWayResult(status.state, roi.name if roi else None, None)

        cosine = cosine_similarity(movement, roi.normal_direction)
        if cosine < self.reverse_threshold:
            status.reverse_frames += 1
            if status.reverse_frames >= self.confirm_frames:
                status.state = VehicleState.WRONG_WAY
            else:
                status.state = VehicleState.WRONG_WAY_CANDIDATE
        else:
            status.reverse_frames = 0
            if status.state != VehicleState.WRONG_WAY:
                status.state = VehicleState.NORMAL

        event_started = status.state == VehicleState.WRONG_WAY and not status.event_logged
        if event_started:
            status.event_logged = True

        return WrongWayResult(status.state, roi.name, cosine, event_started)


def cosine_similarity(a: Vector, b: Vector) -> float:
    a_len = hypot(a[0], a[1])
    b_len = hypot(b[0], b[1])
    if a_len == 0 or b_len == 0:
        return 0.0
    return (a[0] * b[0] + a[1] * b[1]) / (a_len * b_len)


def format_event_log(track_id: int, vehicle_class: str, roi_name: str) -> str:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return (
        f"[{timestamp}]\n"
        "WRONG WAY DETECTED\n"
        f"Track ID: {track_id}\n"
        f"Vehicle: {vehicle_class}\n"
        f"ROI: {roi_name}"
    )
