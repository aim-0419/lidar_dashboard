from __future__ import annotations

from collections import defaultdict, deque
from math import hypot
from typing import Deque, Dict, List, Optional, Tuple


Point = Tuple[int, int]


class TrajectoryStore:
    def __init__(self, max_length: int):
        self._points: Dict[int, Deque[Point]] = defaultdict(lambda: deque(maxlen=max_length))

    def add(self, track_id: int, point: Point) -> None:
        self._points[track_id].append(point)

    def get(self, track_id: int) -> List[Point]:
        return list(self._points.get(track_id, ()))

    def movement_vector(
        self,
        track_id: int,
        min_pixels: float,
        lookback_frames: int | None = None,
    ) -> Optional[Tuple[float, float]]:
        points = self.get(track_id)
        if len(points) < 2:
            return None

        if lookback_frames and lookback_frames > 1:
            points = points[-lookback_frames:]

        start = points[0]
        end = points[-1]
        dx = float(end[0] - start[0])
        dy = float(end[1] - start[1])
        if hypot(dx, dy) < min_pixels:
            return None

        return dx, dy
