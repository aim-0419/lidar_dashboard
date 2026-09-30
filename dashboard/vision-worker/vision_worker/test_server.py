"""Development-only detection; no physical control or database writes."""
import logging
import os
import math
import threading
import time
from collections import deque

import cv2
from flask import Flask, Response, jsonify, request

from .reference import config
from .roi_store import CAMERAS, RoiStore
from .camera_sources import CameraSources
from .reference.detector.vehicle_detector import VehicleDetector
from .reference.tracking.vehicle_tracker import VehicleTracker
from .reference.wrongway.detector import WrongWayDetector
from .reference.wrongway.roi import ROIManager
from .reference.wrongway.trajectory import TrajectoryStore
from .reference.utils.visualization import draw_hud, draw_rois, draw_vehicle

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 65536
store = RoiStore(os.environ.get('ROI_SETTINGS_DIR', '/data/rois'))
sources = CameraSources(os.path.join(os.environ.get('ROI_SETTINGS_DIR', '/data/rois'), 'sources'))
lock = threading.Lock()
state = {"camera": "camera-1", "direction": "normal", "generation": 0, "active_direction": None,
         "tracks": [], "events": [], "error": None, "frame": 0, "video_seconds": 0}
jpeg = None
raw_jpeg = None


@app.route('/cameras/<camera>/source', methods=['GET', 'PUT'])
def camera_source(camera):
    global jpeg, raw_jpeg
    if camera not in CAMERAS:
        return jsonify(error="지원하지 않는 카메라입니다."), 404
    try:
        with lock:
            if request.method == 'PUT':
                sources.save(camera, request.get_json(silent=True))
                if state['camera'] == camera:
                    state.update(generation=state['generation']+1, frame=0,
                                 active_direction=None, tracks=[], events=[], error=None)
                    jpeg = raw_jpeg = None
            return jsonify(sources.public(camera))
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except OSError:
        return jsonify(error="카메라 설정 저장소를 확인하세요."), 500


@app.route('/cameras/<camera>/rois', methods=['GET', 'PUT'])
def camera_rois(camera):
    global jpeg, raw_jpeg
    if camera not in CAMERAS:
        return jsonify(error="지원하지 않는 카메라입니다."), 404
    try:
        with lock:
            if request.method == 'PUT':
                store.save(camera, request.get_json(silent=True))
                if state['camera'] == camera:
                    state.update(generation=state['generation'] + 1, frame=0,
                                 active_direction=None, tracks=[], events=[])
                    jpeg = raw_jpeg = None
            return jsonify(store.load(camera))
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    except OSError:
        logging.exception('ROI storage failed')
        return jsonify(error="ROI 설정을 저장하거나 읽을 수 없습니다."), 500


@app.get('/reference-rois')
def reference_rois():
    return jsonify(rois=[dict(name=r.name, polygon=[[x/1280, y/720] for x,y in r.polygon],
                             direction=[.15*(r.normal_direction[0]/1280)/math.hypot(r.normal_direction[0]/1280,r.normal_direction[1]/720),
                                        .15*(r.normal_direction[1]/720)/math.hypot(r.normal_direction[0]/1280,r.normal_direction[1]/720)])
                        for r in config.SC10_ROIS])


@app.get('/health')
def health():
    return jsonify(service="vision-test", physical_control=False)


@app.get('/state')
def snapshot():
    with lock:
        return jsonify(state)


@app.post('/settings')
def settings():
    global jpeg, raw_jpeg
    body = request.get_json(silent=True)
    if (not isinstance(body, dict) or not {'direction'} <= set(body)
            or set(body) - {'direction', 'camera'}
            or body['direction'] not in ('normal', 'reverse')
            or body.get('camera', 'camera-1') not in CAMERAS):
        return jsonify(error="direction must be normal or reverse"), 400
    with lock:
        state.update(camera=body.get('camera', state['camera']), direction=body['direction'], generation=state['generation'] + 1,
                     active_direction=None, tracks=[], events=[], error=None, frame=0)
        jpeg = raw_jpeg = None
    return jsonify(ok=True)


@app.get('/frame.jpg')
def frame():
    with lock:
        if request.args.get('camera', state['camera']) != state['camera']:
            return '', 409
        content = raw_jpeg if request.args.get('raw') == '1' else jpeg
    if content is None:
        return '', 503
    return Response(content, mimetype='image/jpeg', headers={'Cache-Control': 'no-store'})


class VideoSession:
    def __init__(self, direction, roi_settings, source):
        self.live = source['mode'] == 'rtsp'
        if self.live:
            self.capture = cv2.VideoCapture(source['url'], cv2.CAP_FFMPEG,
                [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000, cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000])
        else:
            self.capture = cv2.VideoCapture('/assets/video.mp4')
        if not self.capture.isOpened():
            self.capture.release()
            raise RuntimeError('Video input unavailable')
        try:
            detector = VehicleDetector('/assets/model.pt', 'cpu', config.CONF_THRESHOLD,
                                       config.VEHICLE_CLASS_IDS, 640, 'bytetrack.yaml')
            self.tracker = VehicleTracker(detector)
        except Exception:
            self.capture.release()
            raise
        size = (int(self.capture.get(cv2.CAP_PROP_FRAME_WIDTH)),
                int(self.capture.get(cv2.CAP_PROP_FRAME_HEIGHT)))
        rois = [config.ROIConfig(r['name'], tuple(tuple(p) for p in r['polygon']),
                                (r['direction'][0]*size[0], r['direction'][1]*size[1]))
                for r in roi_settings['rois']]
        self.rois = ROIManager(rois, reverse_direction=direction == 'reverse',
                               reference_size=(1, 1), frame_size=size)
        self.trajectories = TrajectoryStore(config.TRAJECTORY_LENGTH)
        # 원본 README의 SC10 시각화 테스트와 동일한 3프레임 확정 기준이다.
        self.detector = WrongWayDetector(config.COSINE_REVERSE_THRESHOLD, 3)
        self.events = deque(maxlen=50)
        self.frame_count = 0
        self.fps = self.capture.get(cv2.CAP_PROP_FPS) or 30

    def next_frame(self):
        tick = time.monotonic()
        ok, image = self.capture.read()
        if not ok:
            if self.live:
                raise RuntimeError('Camera disconnected')
            return None
        self.frame_count += 1
        raw_preview = cv2.resize(image, (1280, round(image.shape[0] * 1280 / image.shape[1])))
        raw_ok, raw_buffer = cv2.imencode('.jpg', raw_preview)
        if not raw_ok:
            raise RuntimeError('Raw frame encoding failed')
        detections = self.tracker.update(image)
        results, tracks = {}, []
        draw_rois(image, self.rois.rois)
        for detection in detections:
            track_id = detection.track_id
            self.trajectories.add(track_id, detection.center)
            movement = self.trajectories.movement_vector(track_id, config.MIN_MOVEMENT_PIXELS,
                                                         config.DIRECTION_LOOKBACK_FRAMES)
            roi = self.rois.find(detection.center)
            result = self.detector.update(track_id, movement, roi)
            results[track_id] = result
            if result.event_started:
                self.events.appendleft({'id': track_id, 'roi': result.roi_name,
                                        'time': round(self.frame_count / self.fps, 1)})
            draw_vehicle(image, detection, self.trajectories.get(track_id), result)
            tracks.append({'id': track_id, 'state': result.state.value, 'roi': result.roi_name})
        draw_hud(image, 1 / max(time.monotonic() - tick, .001), results)
        preview = cv2.resize(image, (1280, round(image.shape[0] * 1280 / image.shape[1])))
        encoded, buffer = cv2.imencode('.jpg', preview)
        if not encoded:
            raise RuntimeError('Frame encoding failed')
        return buffer.tobytes(), tracks, raw_buffer.tobytes()

    def close(self):
        self.capture.release()


def run():
    global jpeg, raw_jpeg
    session, generation = None, -1
    while True:
        tick = time.monotonic()
        with lock:
            current, direction = state['generation'], state['direction']
            camera = state['camera']
        try:
            if session is None or generation != current:
                if session is not None:
                    session.close()
                session = None
                session = VideoSession(direction, store.load(camera), sources.load(camera))
                generation = current
            result = session.next_frame()
            if result is None:
                session.close()
                session = None
                continue
            content, tracks, raw_content = result
            with lock:
                # 이전 설정의 결과가 재시작 이후 화면에 섞이지 않게 한다.
                if current == state['generation']:
                    jpeg = content
                    raw_jpeg = raw_content
                    state.update(active_direction=direction, tracks=tracks, events=list(session.events),
                                 frame=session.frame_count, error=None,
                                 video_seconds=round(session.frame_count / session.fps, 1))
        except Exception:
            # 접속 주소에 비밀번호가 포함될 수 있어 예외 문자열을 기록하지 않는다.
            logging.error('Vision input failed for %s', camera)
            with lock:
                if current == state['generation']:
                    state.update(error='영상 연결 또는 처리 실패. 카메라 주소와 네트워크를 확인하세요.', frame=0)
                    jpeg = raw_jpeg = None
            if session is not None:
                session.close()
                session = None
            time.sleep(1)
        # CPU 성능이 낮으면 느리게 재생하되 프레임은 건너뛰지 않는다.
        time.sleep(max(0, 1 / (session.fps if session else 30) - (time.monotonic() - tick)))


if __name__ == '__main__':
    threading.Thread(target=run, daemon=True).start()
    from werkzeug.serving import run_simple
    run_simple('0.0.0.0', 8890, app, threaded=True, use_reloader=False)
