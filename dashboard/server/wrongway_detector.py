# dashboard/server/wrongway_detector.py
# ──────────────────────────────────────────────
# 실시간 카메라 역주행(로터리 시계방향) 차량 YOLO 감지
# YOLOv8n + BoT-SORT 트래커 → MJPEG 스트리밍
# ──────────────────────────────────────────────
import json
import math
import time
import threading
from pathlib import Path
from collections import defaultdict

import cv2
import numpy as np
import requests
from flask import Flask, Response
from flask_cors import CORS
from ultralytics import YOLO

# ── 설정 로드 ──────────────────────────────────
CONFIG_PATH = Path(__file__).parent / "config.json"
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    config = json.load(f)

# 감지 서버 포트
DETECTOR_PORT = config.get("detectorPort", 8765)

# 피드 소스: 카메라 인덱스(int) 또는 파일 경로(str)
_vs = config.get("videoSource")
if _vs and isinstance(_vs, str) and not _vs.isdigit():
    # 상대 경로일 경우 config.json 위치 기준으로 절대 경로 변환
    _vs_path = Path(_vs)
    if not _vs_path.is_absolute():
        VIDEO_SOURCE = str((CONFIG_PATH.parent / _vs).resolve())
    else:
        VIDEO_SOURCE = _vs
else:
    # 기본값 (dashboard-web/public/wrongway_test.mp4)
    VIDEO_SOURCE = str((CONFIG_PATH.parent / ".." / "dashboard-web" / "public" / "wrongway_test.mp4").resolve())

# 로터리 중심 (1280x720 기준 고정 좌표)
_rc = config.get("rotaryCenter", {"x": 540, "y": 510})
ORIGN_CX = _rc.get("x", 540)
ORIGN_CY = _rc.get("y", 510)

# 640x360 좌표계용 보정된 중심
ROTARY_CX = ORIGN_CX * (640/1280)
ROTARY_CY = ORIGN_CY * (360/720)

# 대시보드 서버 (이벤트 전송용)
SERVER_PORT = config.get("serverPort", 5000)
DASHBOARD_BASE = f"http://127.0.0.1:{SERVER_PORT}"

# ── YOLO 모델 로드 ─────────────────────────────
model = YOLO("yolov8n.pt")

# 차량 관련 COCO 클래스 ID
VEHICLE_CLASSES = {2, 3, 5, 7}  # car, motorcycle, bus, truck

# track_id → 이전 중심 좌표 (외적 계산용)
track_prev_center = defaultdict(lambda: None)
# track_id → 누적 외적값 (Displacement)
track_cross_sum = defaultdict(float)
# track_id → 마지막 등장 프레임
track_last_frame = defaultdict(int)
# track_id → 현재 경보 단계 (0: 정상, 1: 경고, 2: 위험)
track_stage = defaultdict(int)
# track_id → 각 단계별 전송 여부
track_alerted_stages = defaultdict(set)

# track_id → 마지막 보관된 박스 정보 (깜빡임 방지용)
track_last_box = defaultdict(lambda: None)

# 설정값
HISTORY_MIN_FRAMES = 10      # 최소 이 정도는 움직여야 판정
CROSS_LIMIT_STAGE1 = -3000   # Stage 1 (Warning) 임계치 (더 둔감하게 조정)
CROSS_LIMIT_STAGE2 = -7000   # Stage 2 (Danger) 임계치 
Correct_MOVEMENT_RESET = 300 # 이만큼 반대로 이동하면 리셋 (Self-correction)
STALE_FRAMES = 30            # 이 프레임 동안 안 보이면 삭제

frame_counter = 0

# ── Flask 앱 ───────────────────────────────────
app = Flask(__name__)
CORS(app)

# 스레드 안전한 프레임 공유
output_frame = None
frame_lock = threading.Lock()


def calculate_cross_product(cx, cy, prev_cx, prev_cy):
    """(이동 벡터) x (중심점 벡터) 외적 계산. 음수이면 로터리 기준 시계방향."""
    v_move = (cx - prev_cx, cy - prev_cy)
    v_rel = (cx - ROTARY_CX, cy - ROTARY_CY)
    # 2D Cross Product: x1*y2 - y1*x2
    return v_move[0] * v_rel[1] - v_move[1] * v_rel[0]


def send_wrongway_alert(track_id, stage):
    """대시보드 서버로 역주행 이벤트 전송 (Stage 포함)."""
    try:
        msg = "역주행 경고 (Stage 1)" if stage == 1 else "역주행 위험 (Stage 2)"
        body = {
            "type": "wrong-way",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "zone_id": "YOLO-ZONE",
            "track_id": f"yolo-{track_id}",
            "stage": stage,
            "confidence": 0.95,
            "message": f"YOLO {msg} - 트랙 #{track_id}",
            "device_id": "YOLO-CAM-01",
        }
        requests.post(f"{DASHBOARD_BASE}/api/wrongway", json=body, timeout=1.5)
        print(f"[alert] Sent id:{track_id} stage:{stage}")
    except Exception as e:
        print(f"[alert] Failed to send alert: {e}")


def cleanup_stale_tracks():
    """오래된 트랙 정리."""
    global frame_counter
    stale_ids = [
        tid for tid, last in track_last_frame.items()
        if frame_counter - last > STALE_FRAMES
    ]
    for tid in stale_ids:
        track_prev_center.pop(tid, None)
        track_cross_sum.pop(tid, None)
        track_last_frame.pop(tid, None)
        track_stage.pop(tid, None)
        track_alerted_stages.pop(tid, None)


def detection_loop():
    """메인 감지 루프 – 별도 스레드에서 실행."""
    global output_frame, frame_counter

    # 비디오 소스 열기
    src = VIDEO_SOURCE
    if isinstance(src, str) and src.isdigit():
        src = int(src)
    cap = cv2.VideoCapture(src)

    if not cap.isOpened():
        print(f"[ERROR] 비디오 소스를 열 수 없습니다: {VIDEO_SOURCE}")
        return

    print(f"[detector] 비디오 소스 열림: {VIDEO_SOURCE}")
    print(f"[detector] 로터리 중심: ({ROTARY_CX}, {ROTARY_CY})")

    while True:
        ret, frame_raw = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        frame_counter += 1

        # 성능 오버홀: 해상도 축소 (640x360) - 처리 및 전송 부하 감소
        frame = cv2.resize(frame_raw, (640, 360))
        h, w = frame.shape[:2]

        # ── 배경 이미지 준비 (감지 스킵 시에도 마지막 박스를 그리기 위함) ──
        annotated = frame.copy()

        # 성능 최적화: 3프레임당 1번만 YOLO 실행
        if frame_counter % 3 != 0:
            # YOLO 스킵 시에도 마지막으로 저장된 모든 박스를 그림 (깜빡임 방지)
            for tid, box_data in track_last_box.items():
                if frame_counter - track_last_frame[tid] < STALE_FRAMES:
                    x1, y1, x2, y2, color, label = box_data
                    cv2.rectangle(annotated, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                    if label:
                        cv2.putText(annotated, f"{label} ID:{tid}", (int(x1), int(y1) - 5), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

            # 스테이터스/중심은 매 프레임 표시
            cv2.putText(annotated, f"YOLO v2.2 | F-Skip:3 | {frame_counter}", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
            cv2.circle(annotated, (int(ROTARY_CX), int(ROTARY_CY)), 5, (255, 0, 255), -1)

            with frame_lock:
                output_frame = annotated
            continue

        # ── YOLO 트래킹 (imgsz=320으로 더욱 축소) ──
        results = model.track(
            frame,
            persist=True,
            tracker="botsort.yaml",
            classes=list(VEHICLE_CLASSES),
            conf=0.25,
            imgsz=320, 
            verbose=False,
        )

        if results and results[0].boxes is not None and results[0].boxes.id is not None:
            boxes = results[0].boxes
            ids = boxes.id.int().cpu().tolist()
            xyxys = boxes.xyxy.cpu().numpy()

            for i, track_id in enumerate(ids):
                x1, y1, x2, y2 = xyxys[i]
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

                last_pos = track_prev_center[track_id]
                if last_pos is not None:
                    # 외적 계산 (방향 판별) - 이제 ROTARY_CX/Y가 640x360 스케일임
                    cross = calculate_cross_product(cx, cy, last_pos[0], last_pos[1])
                    
                    # 노이즈 필터링
                    if abs(cross) > 2.0:
                        track_cross_sum[track_id] += cross
                        # Self-correction: 반대 방향(CCW > 0)으로 주행 시 시계방향 누적값 상쇄
                        if track_cross_sum[track_id] < 0 and cross > 5.0: 
                            track_cross_sum[track_id] += (cross * 3) # 상쇄 속도 3배
                            if track_cross_sum[track_id] > 0: track_cross_sum[track_id] = 0

                track_prev_center[track_id] = (cx, cy)
                track_last_frame[track_id] = frame_counter

                # 단계 판단
                c_sum = track_cross_sum[track_id]
                current_stage = 0
                if c_sum <= CROSS_LIMIT_STAGE2: current_stage = 2
                elif c_sum <= CROSS_LIMIT_STAGE1: current_stage = 1
                
                track_stage[track_id] = current_stage

                # 그리기 (경고/위험 단계일 때만 박스 표시)
                label_text = ""
                color = None
                
                if current_stage == 1:
                    color = (0, 255, 255) # Yellow
                    label_text = "WARNING"
                elif current_stage == 2:
                    color = (0, 0, 255)   # Red
                    label_text = "DANGER"

                if color:
                    cv2.rectangle(annotated, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                    cv2.putText(annotated, f"{label_text} ID:{track_id}", (int(x1), int(y1) - 5), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                    # 마지막 박스 정보 업데이트 (깜빡임 방지)
                    track_last_box[track_id] = (x1, y1, x2, y2, color, label_text)
                else:
                    # 정상 차량은 박스 정보 삭제 (이전 프레임 잔상 제거)
                    track_last_box.pop(track_id, None)

                # 이벤트 전송 로직 (이미 해당 단계 알렸으면 패스)
                if current_stage > 0:
                    if current_stage not in track_alerted_stages[track_id]:
                        track_alerted_stages[track_id].add(current_stage)
                        threading.Thread(target=send_wrongway_alert, args=(track_id, current_stage), daemon=True).start()

        # 스테이터스 표시 (V4로 변경하여 확인)
        cv2.putText(annotated, f"YOLO V4 | CLEAN UI | PORT 8888", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        
        with frame_lock:
            output_frame = annotated

        time.sleep(0.01) # 루프 제어

    cap.release()

    cap.release()


def generate_mjpeg():
    """MJPEG 프레임 제너레이터."""
    while True:
        with frame_lock:
            if output_frame is None:
                time.sleep(0.05)
                continue
            _, jpeg = cv2.imencode(
                ".jpg", output_frame, [cv2.IMWRITE_JPEG_QUALITY, 50]
            )

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n"
        )
        time.sleep(0.04)


@app.route("/video_feed")
def video_feed():
    """MJPEG 스트림 엔드포인트."""
    return Response(
        generate_mjpeg(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/health")
def health():
    return {"ok": True, "frame": frame_counter}


# ── 메인 ───────────────────────────────────────
if __name__ == "__main__":
    print(f"[detector] 역주행 감지 서버 시작 (port {DETECTOR_PORT})")
    print(f"[detector] MJPEG 스트림: http://localhost:{DETECTOR_PORT}/video_feed")

    # 감지 루프를 백그라운드 스레드로 시작
    det_thread = threading.Thread(target=detection_loop, daemon=True)
    det_thread.start()

    # Flask MJPEG 서버 시작
    app.run(host="0.0.0.0", port=DETECTOR_PORT, threaded=True)
