"""Camera-local normalized ROI settings."""
import json
import math
import os
import tempfile
from pathlib import Path

CAMERAS = tuple(f"camera-{i}" for i in range(1, 7))


def validate(body):
    if not isinstance(body, dict) or set(body) != {"rois"}:
        raise ValueError("rois 배열이 필요합니다.")
    rois = body["rois"]
    if not isinstance(rois, list) or len(rois) > 16:
        raise ValueError("ROI는 최대 16개까지 설정할 수 있습니다.")
    names = set()
    def point(p, bounded=True):
        return (isinstance(p, list) and len(p) == 2
                and all(type(v) in (int, float) and math.isfinite(v)
                        and (not bounded or 0 <= v <= 1) for v in p))
    def cross(a, b, c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    def intersects(a, b, c, d):
        if max(a[0], b[0]) < min(c[0], d[0]) or max(c[0], d[0]) < min(a[0], b[0]):
            return False
        if max(a[1], b[1]) < min(c[1], d[1]) or max(c[1], d[1]) < min(a[1], b[1]):
            return False
        return cross(a,b,c)*cross(a,b,d) <= 0 and cross(c,d,a)*cross(c,d,b) <= 0
    for roi in rois:
        if not isinstance(roi, dict) or set(roi) != {"name", "polygon", "direction"}:
            raise ValueError("ROI 형식이 올바르지 않습니다.")
        name, poly, direction = roi["name"], roi["polygon"], roi["direction"]
        if not isinstance(name, str) or not name.strip() or len(name) > 40 or name in names:
            raise ValueError("영역 이름은 중복 없이 1~40자로 입력하세요.")
        names.add(name)
        if not isinstance(poly, list) or not 3 <= len(poly) <= 20 or not all(point(p) for p in poly):
            raise ValueError("꼭짓점은 0~1 좌표로 3~20개가 필요합니다.")
        n = len(poly)
        if len(set(map(tuple, poly))) != n:
            raise ValueError("꼭짓점이 중복되었습니다.")
        area = abs(sum(poly[i][0]*poly[(i+1)%n][1]-poly[(i+1)%n][0]*poly[i][1] for i in range(n)))/2
        if area < .0001:
            raise ValueError("영역 면적이 너무 작습니다.")
        for i in range(n):
            for j in range(i+1, n):
                if j == i+1 or (i == 0 and j == n-1):
                    continue
                if intersects(poly[i], poly[(i+1)%n], poly[j], poly[(j+1)%n]):
                    raise ValueError("영역의 선이 서로 교차합니다.")
        if not point(direction, False) or not .001 <= math.hypot(*direction) <= 2:
            raise ValueError("정상 방향 화살표의 길이가 올바르지 않습니다.")
    return body


class RoiStore:
    def __init__(self, directory):
        self.directory = Path(directory)

    def path(self, camera):
        if camera not in CAMERAS:
            raise ValueError("지원하지 않는 카메라입니다.")
        return self.directory / (camera + ".json")

    def load(self, camera):
        path = self.path(camera)
        if not path.exists():
            return {"rois": []}
        return validate(json.loads(path.read_text(encoding="utf-8")))

    def save(self, camera, body):
        path = self.path(camera)
        validate(body)
        self.directory.mkdir(parents=True, exist_ok=True)
        # 실패 시 기존 설정 파일을 보존하도록 같은 디렉터리에서 원자적으로 교체한다.
        fd, temp = tempfile.mkstemp(dir=self.directory, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                json.dump(body, stream, ensure_ascii=False, allow_nan=False)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp, path)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)
