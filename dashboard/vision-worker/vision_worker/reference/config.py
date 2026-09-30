from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple


CONF_THRESHOLD = 0.4
TRAJECTORY_LENGTH = 20
DIRECTION_LOOKBACK_FRAMES = 8
MIN_MOVEMENT_PIXELS = 15.0
WRONG_WAY_CONFIRM_FRAMES = 10
COSINE_REVERSE_THRESHOLD = -0.45

DEFAULT_MODEL = "yolo11s.pt"
DEFAULT_SOURCE = "videos/roundabout.mp4"
DEFAULT_OUTPUT = "outputs/roundabout_result.mp4"
EVENTS_CSV = "outputs/events.csv"
ROI_REFERENCE_SIZE = (1280, 720)

VEHICLE_CLASS_NAMES = {"car", "motorcycle", "bus", "truck"}
VEHICLE_CLASS_IDS = [2, 3, 5, 7]


@dataclass(frozen=True)
class ROIConfig:
    name: str
    polygon: Tuple[Tuple[int, int], ...]
    normal_direction: Tuple[float, float]


# Default ROI values for the included 1280x720 preview coordinate system.
# They are scaled automatically to the actual input frame size.
# OpenCV pixel coordinates use x to the right and y downward.
SC10_ROIS = [
    ROIConfig(
        name="West_Approach",
        polygon=((350, 292), (642, 292), (655, 338), (410, 358)),
        normal_direction=(1.0, 0.1),
    ),
    ROIConfig(
        name="North_Approach",
        polygon=((635, 20), (828, 218), (785, 326), (585, 122)),
        normal_direction=(0.25, 1.0),
    ),
    ROIConfig(
        name="East_Approach",
        polygon=((792, 292), (1252, 292), (1280, 326), (790, 348)),
        normal_direction=(-1.0, -0.05),
    ),
    ROIConfig(
        name="South_Approach",
        polygon=((350, 720), (606, 424), (704, 460), (510, 720)),
        normal_direction=(0.65, -1.0),
    ),
]

ROUNDABOUTHD_CAM02_ROIS = [
    ROIConfig(
        name="Cam02_Ring_Front_Left",
        polygon=((225, 260), (260, 300), (390, 330), (560, 346), (610, 276), (460, 263), (365, 244)),
        normal_direction=(1.0, 0.0),
    ),
    ROIConfig(
        name="Cam02_Ring_Front_Right",
        polygon=((560, 346), (730, 350), (900, 335), (1030, 310), (880, 252), (760, 268), (610, 276)),
        normal_direction=(1.0, -0.05),
    ),
    ROIConfig(
        name="Cam02_Ring_Right",
        polygon=((1030, 310), (1080, 275), (1085, 240), (1010, 205), (920, 230), (918, 255), (880, 280)),
        normal_direction=(0.35, -1.0),
    ),
    ROIConfig(
        name="Cam02_Ring_Back_Right",
        polygon=((1010, 205), (830, 175), (690, 163), (735, 180), (860, 198), (930, 226)),
        normal_direction=(-1.0, -0.2),
    ),
    ROIConfig(
        name="Cam02_Ring_Back_Left",
        polygon=((690, 163), (540, 160), (390, 170), (300, 195), (405, 214), (510, 178), (620, 176), (735, 180)),
        normal_direction=(-1.0, 0.0),
    ),
    ROIConfig(
        name="Cam02_Ring_Left",
        polygon=((300, 195), (240, 230), (225, 260), (365, 255), (410, 225)),
        normal_direction=(-0.2, 1.0),
    ),
]

ROI_PRESETS = {
    "sc10": SC10_ROIS,
    "roundabouthd_cam02": ROUNDABOUTHD_CAM02_ROIS,
}

ROIS = SC10_ROIS
