from __future__ import annotations

from dataclasses import dataclass
from math import hypot
from typing import Iterable, Optional, Tuple

import cv2
import numpy as np

from vision_worker.reference.config import ROIConfig


Point = Tuple[int, int]
Vector = Tuple[float, float]


@dataclass(frozen=True)
class ROI:
    name: str
    polygon: np.ndarray
    normal_direction: Vector

    @classmethod
    def from_config(
        cls,
        config: ROIConfig,
        reverse_direction: bool = False,
        scale: tuple[float, float] = (1.0, 1.0),
    ) -> "ROI":
        direction = config.normal_direction
        if reverse_direction:
            direction = (-direction[0], -direction[1])
        scaled_polygon = [
            (int(round(x * scale[0])), int(round(y * scale[1])))
            for x, y in config.polygon
        ]
        return cls(
            name=config.name,
            polygon=np.array(scaled_polygon, dtype=np.int32),
            normal_direction=normalize(direction),
        )

    def contains(self, point: Point) -> bool:
        return cv2.pointPolygonTest(self.polygon, point, False) >= 0

    def center(self) -> Point:
        moments = cv2.moments(self.polygon)
        if moments["m00"] == 0:
            mean = self.polygon.mean(axis=0)
            return int(mean[0]), int(mean[1])
        return int(moments["m10"] / moments["m00"]), int(moments["m01"] / moments["m00"])


def normalize(vector: Vector) -> Vector:
    length = hypot(vector[0], vector[1])
    if length == 0:
        raise ValueError("ROI normal_direction must not be a zero vector")
    return vector[0] / length, vector[1] / length


class ROIManager:
    def __init__(
        self,
        roi_configs: Iterable[ROIConfig],
        reverse_direction: bool = False,
        reference_size: tuple[int, int] | None = None,
        frame_size: tuple[int, int] | None = None,
    ):
        scale = (1.0, 1.0)
        if reference_size and frame_size:
            scale = (frame_size[0] / reference_size[0], frame_size[1] / reference_size[1])
        self.rois = [
            ROI.from_config(config, reverse_direction, scale)
            for config in roi_configs
        ]

    def find(self, point: Point) -> Optional[ROI]:
        for roi in self.rois:
            if roi.contains(point):
                return roi
        return None
