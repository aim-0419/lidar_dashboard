import json
import os
import tempfile
from pathlib import Path
from urllib.parse import urlsplit
from .roi_store import CAMERAS


class CameraSources:
    def __init__(self, directory):
        self.directory = Path(directory)

    def path(self, camera):
        if camera not in CAMERAS:
            raise ValueError("지원하지 않는 카메라입니다.")
        return self.directory / (camera + ".json")

    def load(self, camera):
        path = self.path(camera)
        return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {"mode": "test", "url": ""}

    def public(self, camera):
        data = self.load(camera)
        return {"mode": data["mode"], "configured": bool(data["url"])}

    def save(self, camera, body):
        path = self.path(camera)
        if not isinstance(body, dict) or set(body) - {"mode", "url"} or body.get("mode") not in ("test", "rtsp"):
            raise ValueError("영상 입력 모드를 확인하세요.")
        old = self.load(camera)
        url = body.get("url", old["url"])
        if not isinstance(url, str) or len(url) > 2048 or any(ord(c) < 32 for c in url):
            raise ValueError("RTSP 주소 형식이 올바르지 않습니다.")
        if url:
            try:
                parsed = urlsplit(url)
                valid = parsed.scheme in ("rtsp", "rtsps") and parsed.hostname and not parsed.fragment
                _ = parsed.port
            except ValueError:
                valid = False
            if not valid:
                raise ValueError("rtsp:// 또는 rtsps:// 주소를 입력하세요.")
        if body["mode"] == "rtsp" and not url:
            raise ValueError("RTSP 주소를 먼저 입력하세요.")
        self.directory.mkdir(parents=True, exist_ok=True)
        fd, temp = tempfile.mkstemp(dir=self.directory)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                json.dump({"mode": body["mode"], "url": url}, stream)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp, path)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)
