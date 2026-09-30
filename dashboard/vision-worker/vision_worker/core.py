from dataclasses import dataclass
from enum import Enum
from math import hypot


class Gate(str, Enum):
    UNKNOWN = "unknown"
    OPEN = "open"
    CLOSED = "closed"
    MOVING = "moving"


@dataclass(frozen=True)
class Observation:
    track_id: str
    point: tuple[float, float]


@dataclass
class Track:
    point: tuple[float, float]
    seen_at: float
    reverse_since: float | None = None
    normal_since: float | None = None
    hazardous: bool = False


@dataclass(frozen=True)
class Intent:
    action: str
    reason: str


class ZoneController:
    """One camera zone; timestamps are monotonic seconds, not frame counts."""

    def __init__(self, direction, confirm_seconds=1.0, recovery_seconds=2.0,
                 clear_seconds=3.0, lost_seconds=2.0, min_pixels=2.0,
                 command_timeout=5.0):
        length = hypot(*direction)
        if length == 0 or min(confirm_seconds, recovery_seconds, clear_seconds,
                              lost_seconds, min_pixels, command_timeout) <= 0:
            raise ValueError("Nonzero direction and positive thresholds required")
        self.direction = tuple(v / length for v in direction)
        self.confirm_seconds = confirm_seconds
        self.recovery_seconds = recovery_seconds
        self.clear_seconds = clear_seconds
        self.lost_seconds = lost_seconds
        self.min_pixels = min_pixels
        self.command_timeout = command_timeout
        self.tracks = {}
        self.last_time = None
        self.clear_since = None
        self.pending = None
        self.pending_since = None
        self.command_fault = False
        self.incident = False

    def step(self, now, observations, *, healthy, gate=Gate.UNKNOWN,
             safety_clear=False, exited=()):
        if self.last_time is not None and now <= self.last_time:
            raise ValueError("Frames must have strictly increasing timestamps")
        observations = list(observations)
        if len({o.track_id for o in observations}) != len(observations):
            raise ValueError("Duplicate track ID in frame")
        self.last_time = now
        intents = []
        # Completion feedback is separate from command acceptance.
        if self.pending and ((self.pending == "close" and gate == Gate.CLOSED)
                             or (self.pending == "open" and gate == Gate.OPEN)):
            if self.pending == "open":
                self.incident = False
            self.pending = self.pending_since = None
        if self.pending and now - self.pending_since >= self.command_timeout:
            self.command_fault = True

        if not healthy:
            self.clear_since = None
            for t in self.tracks.values():
                t.reverse_since = t.normal_since = None
            return []

        for o in observations:
            old = self.tracks.get(o.track_id)
            if old is None:
                self.tracks[o.track_id] = Track(o.point, now)
                continue
            dx, dy = o.point[0] - old.point[0], o.point[1] - old.point[1]
            distance = hypot(dx, dy)
            gap = now - old.seen_at > self.lost_seconds
            old.point, old.seen_at = o.point, now
            if gap or distance < self.min_pixels:
                old.reverse_since = old.normal_since = None
                continue
            cosine = (dx * self.direction[0] + dy * self.direction[1]) / distance
            if cosine < -0.45:
                old.normal_since = None
                if old.reverse_since is None:
                    old.reverse_since = now
                if now - old.reverse_since >= self.confirm_seconds:
                    old.hazardous = True
                    self.incident = True
            elif cosine > 0.45:
                old.reverse_since = None
                if old.normal_since is None:
                    old.normal_since = now
                if now - old.normal_since >= self.recovery_seconds:
                    old.hazardous = False
            else:
                old.reverse_since = old.normal_since = None

        # Only an explicitly confirmed boundary crossing may remove a hazard.
        for track_id in exited:
            self.tracks.pop(track_id, None)
        for key, t in list(self.tracks.items()):
            if now - t.seen_at > self.lost_seconds:
                t.reverse_since = t.normal_since = None
                if not t.hazardous:
                    del self.tracks[key]

        danger = any(t.hazardous for t in self.tracks.values())
        candidates = any(t.reverse_since is not None for t in self.tracks.values())
        if danger:
            self.clear_since = None
            if gate != Gate.CLOSED and self.pending != "close" and not self.command_fault:
                self.pending, self.pending_since = "close", now
                intents.append(Intent("close", "wrong_way_confirmed"))
        elif self.incident and not candidates and safety_clear and gate == Gate.CLOSED:
            if self.clear_since is None:
                self.clear_since = now
            if now - self.clear_since >= self.clear_seconds and not self.pending and not self.command_fault:
                self.pending, self.pending_since = "open", now
                intents.append(Intent("open", "zone_clear_and_safety_confirmed"))
        else:
            self.clear_since = None
        return intents
