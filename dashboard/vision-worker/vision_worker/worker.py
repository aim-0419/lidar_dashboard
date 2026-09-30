from typing import Protocol
from .core import Gate


class ControlBoard(Protocol):
    def status(self) -> tuple[Gate, bool]:
        """Return physical gate state and fresh hardware safety-clear feedback."""
        ...

    def request(self, action: str) -> None:
        """Send intent using the agreed protocol; acceptance is not completion."""
        ...


class VisionWorker:
    """Inject capture/detector/board integrations without coupling to the dashboard."""

    def __init__(self, controller, tracker, board, contains, on_event):
        self.controller = controller
        self.tracker = tracker
        self.board = board
        self.contains = contains
        self.on_event = on_event

    def process(self, frame, now):
        try:
            gate, safe = self.board.status()
        except Exception:
            gate, safe = Gate.UNKNOWN, False
        try:
            observations = [] if frame is None else self.tracker.update(frame)
        except Exception:
            self.controller.step(now, [], healthy=False, gate=gate)
            raise
        intents = self.controller.step(
            now, [o for o in observations if self.contains(o.point)],
            healthy=frame is not None, gate=gate, safety_clear=safe,
        )
        for intent in intents:
            try:
                self.board.request(intent.action)
            except Exception:
                self.controller.command_fault = True
                raise
            self.on_event(intent)
        return intents
