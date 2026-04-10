# dashboard/server/wrongway_detector.py
# ──────────────────────────────────────────────
# 실시간 카메라 역주행(로터리 시계방향) 차량 YOLO 감지
# YOLOv8n + BoT-SORT 트래커 → MJPEG 스트리밍
# ──────────────────────────────────────────────
import json
import math
import random
import time
import threading
from pathlib import Path
from collections import defaultdict

import cv2
import numpy as np
import requests
import base64
from flask import Flask, Response
from flask_cors import CORS
from ultralytics import YOLO

# ── 설정 로드 ──────────────────────────────────
CONFIG_PATH = Path(__file__).parent / "config.json"
with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    config = json.load(f)
    
# ------------------------------
# Serial Port
#------------------------------
import serial

try:
    ser = serial.Serial(
        port=config.get("serialPort"),
        baudrate=config.get("baudRate", 9600),
        timeout=1
    )
    print(f"[serial] opened: {ser.port} / {ser.baudrate} / open={ser.is_open}") # 시리얼 포트 정보 출력
except Exception as e:
    ser = None
    print(f"[serial] init failed: {e}") # 시리얼 포트 초기화 실패 시 오류 메시지 출력

# ------------------------------
# RS485 Protocol Packets
# ------------------------------

# 시나리오1 1차경고 (LED + 스피커)
cmdScenario1 = bytes([0x02,0xA1,0x10,0x01,0x01,0x02,0x00,0xD2,0x03,0x0D])
# 시나리오2 : 2차 경고 (전체 설비)
cmdScenario2 = bytes([0x02,0xA1,0x10,0x02,0x01,0x01,0x00,0x10,0x03,0x0D])
# 시나리오3 : 2차 경고 종료 및 차단기 복귀
cmdScenario3 = bytes([0x02,0xA1,0x10,0x02,0x02,0x12,0x00,0x6F,0x03,0x0D])
# 시나리오4 : 전체 리셋
cmdScenario4 = bytes([0x02,0xA1,0x10,0x00,0x00,0x01,0x00,0x2E,0x03,0x0D])

# 시리얼 전송 함수
def send_serial(cmd, label):
    try:
        if ser and ser.is_open:
            ser.write(cmd)
            print(f"[serial] {label}")
        else:
            print(f"[serial] skip ({label})")
    except Exception as e:
        print(f"[serial] 시리얼 전송 오류: {e}")   

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
DASHBOARD_IP = config.get("dashboardIP", "127.0.0.1")
DASHBOARD_BASE = f"http://{DASHBOARD_IP}:{SERVER_PORT}"

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
# track_id → Stage 1 전송 시각 (Stage 2 지연용)
track_stage1_time = defaultdict(float)

# track_id → 마지막 보관된 박스 정보 (깜빡임 방지용)
track_last_box = defaultdict(lambda: None)

# 이번 주기에서 카운트된 트랙 ID 세트 (중복 통과 방지)
counted_ids = set()

# 설정값
HISTORY_MIN_FRAMES = 10      # 최소 이 정도는 움직여야 판정
CROSS_LIMIT_STAGE1 = -3000   # Stage 1 (Warning) 임계치
CROSS_LIMIT_STAGE2 = -15000  # Stage 2 (Danger) 임계치 (더 긴 지속 역주행 필요)
Correct_MOVEMENT_RESET = 300 # 이만큼 반대로 이동하면 리셋 (Self-correction)
STALE_FRAMES = 30            # 이 프레임 동안 안 보이면 삭제

frame_counter = 0

# 데모 모드 플래그 (테스트용, 실제 운영 시 False로)
demo_active = False
demo_reset_requested = False

DEMO_START_SEC = 0.0
DEMO_END_SEC = 36.5

standby_frame_raw = None

# ── Flask 앱 ───────────────────────────────────
app = Flask(__name__)
CORS(app)

# 스레드 안전한 프레임 공유
output_frame = None
frame_lock = threading.Lock()

# 라이다 시각화 프레임 공유
lidar_frame = None
lidar_frame_lock = threading.Lock()
prev_lidar_canvas = None  # 이전 프레임 (템포럴 블렌딩용)

# 라이다 시각화용 스캔 각도
scan_angle = 0.0


def generate_lidar_view(frame, vehicle_boxes=None):
    """카메라 프레임을 라이다 포인트 클라우드 스타일로 변환. 안정적 샘플링 + 템포럴 블렌딩.
    
    Args:
        frame: BGR 입력 프레임 (640x360)
        vehicle_boxes: [(x1, y1, x2, y2, stage, track_id), ...] 감지된 차량 목록
    Returns:
        라이다 시각화 프레임 (640x360)
    """
    global scan_angle, prev_lidar_canvas
    h, w = frame.shape[:2]
    
    # 검은 배경
    canvas = np.zeros((h, w, 3), dtype=np.uint8)
    
    # 1) 그레이스케일 → Canny 에지 검출
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 40, 120)
    
    # 2) 에지 포인트에서 샘플링하여 포인트 클라우드 생성
    edge_points = np.column_stack(np.where(edges > 0))  # (y, x) 형태
    
    # 차량 영역 마스크 생성
    vehicle_mask = np.zeros((h, w), dtype=np.uint8)
    if vehicle_boxes:
        for (vx1, vy1, vx2, vy2, stage, tid) in vehicle_boxes:
            cv2.rectangle(vehicle_mask, (int(vx1), int(vy1)), (int(vx2), int(vy2)), 255, -1)
    
    if len(edge_points) > 0:
        # 포인트 수 제한 (성능 + 라이다 느낌)
        n_points = min(len(edge_points), 8000)
        # 고정 시드로 안정적 샘플링 (3프레임마다 갱신)
        rng = np.random.RandomState(seed=(frame_counter // 6) * 42)
        indices = rng.choice(len(edge_points), n_points, replace=False)
        sampled = edge_points[indices]
        
        for pt in sampled:
            y, x = pt
            # 차량 영역인지 확인
            is_vehicle = vehicle_mask[y, x] > 0
            
            if is_vehicle:
                # 차량 포인트 — 밝은 색상
                color = (0, 200, 255)   # 노란색 (BGR)
            else:
                # 배경 포인트 — 녹색 계열 (거리감 표현: 위쪽=먼곳은 어둡게)
                intensity = int(80 + (y / h) * 175)
                color = (0, intensity, int(intensity * 0.3))
            
            # 포인트 크기 (해시 기반 결정론적)
            size = 1 if ((x * 7 + y * 13) % 20) > 2 else 2
            cv2.circle(canvas, (x, y), size, color, -1)
    
    # 3) 비-에지 영역에도 희미한 포인트 (밀도감) — 고정 시드
    n_noise = 1500
    noise_rng = np.random.RandomState(seed=12345)
    noise_x = noise_rng.randint(0, w, n_noise)
    noise_y = noise_rng.randint(0, h, n_noise)
    for nx, ny in zip(noise_x, noise_y):
        brightness = gray[ny, nx]
        if brightness > 30:  # 너무 어두운 곳은 스킵
            intensity = int(brightness * 0.15)
            cv2.circle(canvas, (int(nx), int(ny)), 1, (0, intensity, int(intensity * 0.2)), -1)
    
    # 4) 차량 바운딩 박스 + 라벨 (라이다 스타일)
    vehicle_count = 0
    if vehicle_boxes:
        for (vx1, vy1, vx2, vy2, stage, tid) in vehicle_boxes:
            vehicle_count += 1
            if stage == 2:
                box_color = (0, 0, 255)      # 빨간색 — 위험
                label = f"DANGER #{tid}"
            elif stage == 1:
                box_color = (0, 200, 255)    # 노란색 — 경고
                label = f"WARNING #{tid}"
            else:
                box_color = (0, 255, 100)    # 초록색 — 정상 차량
                label = f"VEH #{tid}"
            
            # 점선 스타일 바운딩 박스
            x1i, y1i, x2i, y2i = int(vx1), int(vy1), int(vx2), int(vy2)
            # 상하 변
            for sx in range(x1i, x2i, 8):
                cv2.line(canvas, (sx, y1i), (min(sx + 4, x2i), y1i), box_color, 1)
                cv2.line(canvas, (sx, y2i), (min(sx + 4, x2i), y2i), box_color, 1)
            # 좌우 변
            for sy in range(y1i, y2i, 8):
                cv2.line(canvas, (x1i, sy), (x1i, min(sy + 4, y2i)), box_color, 1)
                cv2.line(canvas, (x2i, sy), (x2i, min(sy + 4, y2i)), box_color, 1)
            
            # 라벨
            cv2.putText(canvas, label, (x1i, y1i - 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, box_color, 1)
    
    # 5) 레이더 스위프 라인 (회전 효과)
    center_x, center_y = w // 2, h // 2
    scan_len = max(w, h)
    end_x = int(center_x + scan_len * math.cos(math.radians(scan_angle)))
    end_y = int(center_y + scan_len * math.sin(math.radians(scan_angle)))
    
    # 스위프 라인 (반투명 효과를 위한 밝기 조절)
    overlay = canvas.copy()
    cv2.line(overlay, (center_x, center_y), (end_x, end_y), (0, 80, 0), 1)
    # 잔상 효과 (이전 각도들)
    for i in range(1, 15):
        prev_a = scan_angle - i * 2
        px = int(center_x + scan_len * math.cos(math.radians(prev_a)))
        py = int(center_y + scan_len * math.sin(math.radians(prev_a)))
        alpha = max(0, 60 - i * 4)
        cv2.line(overlay, (center_x, center_y), (px, py), (0, alpha, 0), 1)
    
    cv2.addWeighted(overlay, 0.4, canvas, 0.6, 0, canvas)
    scan_angle = (scan_angle + 6) % 360
    
    # 6) 격자 오버레이 (라이다 디스플레이 느낌)
    grid_color = (0, 30, 0)
    for gx in range(0, w, 80):
        cv2.line(canvas, (gx, 0), (gx, h), grid_color, 1)
    for gy in range(0, h, 80):
        cv2.line(canvas, (0, gy), (w, gy), grid_color, 1)
    
    # 7) HUD 오버레이
    pts_count = len(edge_points) if len(edge_points) > 0 else 0
    hud_texts = [
        f"PTS: {pts_count:,}",
        f"FREQ: 10Hz",
        f"VEH: {vehicle_count}",
    ]
    # 하단 좌측 HUD
    for i, txt in enumerate(hud_texts):
        y_pos = h - 12 - i * 18
        cv2.putText(canvas, txt, (8, y_pos),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 0), 1)
    
    # 상단 좌측 타이틀
    cv2.putText(canvas, "LIDAR POINT CLOUD", (8, 20),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 180, 0), 1)
    cv2.putText(canvas, f"SCAN {int(scan_angle)}deg", (8, 38),
                cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 120, 0), 1)
    
    # 8) 이전 프레임과 블렌딩 (반짝임 억제)
    if prev_lidar_canvas is not None and prev_lidar_canvas.shape == canvas.shape:
        canvas = cv2.addWeighted(canvas, 0.65, prev_lidar_canvas, 0.35, 0)
    prev_lidar_canvas = canvas.copy()
    
    return canvas


def calculate_cross_product(cx, cy, prev_cx, prev_cy):
    """(이동 벡터) x (중심점 벡터) 외적 계산. 음수이면 로터리 기준 시계방향."""
    v_move = (cx - prev_cx, cy - prev_cy)
    v_rel = (cx - ROTARY_CX, cy - ROTARY_CY)
    # 2D Cross Product: x1*y2 - y1*x2
    return v_move[0] * v_rel[1] - v_move[1] * v_rel[0]


def send_wrongway_alert(track_id, stage, frame=None):
    """대시보드 서버로 역주행 이벤트 전송 (Stage 포함 + 스냅샷)."""
    try:
        msg = "역주행 경고 (Stage 1)" if stage == 1 else "역주행 위험 (Stage 2)"
        
        snapshot_b64 = None
        if frame is not None:
            # JPEG 인코딩
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
            # Base64 변환
            snapshot_b64 = base64.b64encode(buffer).decode('utf-8')

        body = {
            "type": "wrong-way",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "zone_id": "YOLO-ZONE",
            "track_id": f"yolo-{track_id}",
            "stage": stage,
            "confidence": 0.95,
            "message": f"{msg} - 트랙 #{track_id}",
            "device_id": "YOLO-CAM-01",
            "snapshot": snapshot_b64  # Base64 이미지 추가
        }
        requests.post(f"{DASHBOARD_BASE}/api/wrongway", json=body, timeout=1.5)
        print(f"[alert] Sent id:{track_id} stage:{stage} (with snapshot)")
    except Exception as e:
        print(f"[alert] Failed to send alert: {e}")
def send_vehicle_pass():
    """대시보드 서버로 차량 통과 신호 전송."""
    try:
        requests.post(f"{DASHBOARD_BASE}/api/vehicle/pass", json={}, timeout=1.0)
        # print(f"[pass] Vehicle counted")
    except Exception as e:
        print(f"[pass] Failed to send vehicle pass: {e}")

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

# 트래킹 상태 초기화 (데모 모드 시작/종료 시 사용)
def reset_tracking_state():
    track_prev_center.clear()
    track_cross_sum.clear()
    track_last_frame.clear()
    track_stage.clear()
    track_alerted_stages.clear()
    track_stage1_time.clear()
    track_last_box.clear()
    counted_ids.clear()
    
def detection_loop():
    """메인 감지 루프 – 별도 스레드에서 실행."""
    global output_frame, lidar_frame, frame_counter, demo_active, demo_reset_requested

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
    
    # 시작 위치 맞춤
    global standby_frame_raw

    cap.set(cv2.CAP_PROP_POS_MSEC, DEMO_START_SEC * 1000)
    ok, first_frame = cap.read()
    if ok:
        standby_frame_raw = first_frame.copy()
    else:
        print("[ERROR] 시작 프레임을 읽을 수 없습니다.")
        return

    cap.set(cv2.CAP_PROP_POS_MSEC, DEMO_START_SEC * 1000)


    while True:
                # START 눌렀을 때 시작 위치로 이동
        if demo_reset_requested:
            cap.set(cv2.CAP_PROP_POS_MSEC, DEMO_START_SEC * 1000)
            demo_reset_requested = False

        # 시작 전 / 종료 후: 멈춘 화면만 보여줌
        if not demo_active:
            if standby_frame_raw is None:
                time.sleep(0.05)
                continue

            frame = cv2.resize(standby_frame_raw, (640, 360))
            annotated = frame.copy()

            cv2.putText(
                annotated,
                "DEMO READY",
                (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 255),
                2,
            )

            lv = generate_lidar_view(frame, [])

            with lidar_frame_lock:
                lidar_frame = lv

            with frame_lock:
                output_frame = annotated

            time.sleep(0.03)
            continue
              
        ret, frame_raw = cap.read()
        if not ret:
            demo_active = False
            reset_tracking_state()
            cap.set(cv2.CAP_PROP_POS_MSEC, DEMO_START_SEC * 1000)
            continue

        current_sec = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
        if current_sec >= DEMO_END_SEC:
            demo_active = False
            reset_tracking_state()
            cap.set(cv2.CAP_PROP_POS_MSEC, DEMO_START_SEC * 1000)
            print("[demo] finished")
            continue

        frame_counter += 1

        # 성능 오버홀: 해상도 축소 (640x360) - 처리 및 전송 부하 감소
        frame = cv2.resize(frame_raw, (640, 360))
        h, w = frame.shape[:2]

        # ── 배경 이미지 준비 (감지 스킵 시에도 마지막 박스를 그리기 위함) ──
        annotated = frame.copy()

        # 성능 최적화: 3프레임당 1번만 YOLO 실행
        if frame_counter % 3 != 0:
            # YOLO 스킵 시에도 마지막으로 저장된 모든 박스 정보를 lidar_boxes에 추가 (라이다용)
            lidar_boxes = []
            for tid, box_data in track_last_box.items():
                if frame_counter - track_last_frame[tid] < STALE_FRAMES:
                    x1, y1, x2, y2, color, label = box_data
                    # (카메라 뷰 박스 그리기 제거)
                    stage = track_stage.get(tid, 0)
                    lidar_boxes.append((x1, y1, x2, y2, stage, tid))

            # 스테이터스/중심은 매 프레임 표시
            cv2.putText(annotated, f"YOLO v2.2 | F-Skip:3 | {frame_counter}", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
            cv2.circle(annotated, (int(ROTARY_CX), int(ROTARY_CY)), 5, (255, 0, 255), -1)

            # 라이다 시각화 (스킵 프레임에서도 업데이트)
            lv = generate_lidar_view(frame, lidar_boxes)
            with lidar_frame_lock:
                lidar_frame = lv

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

                # 차량 통과 카운팅 (신규 트랙 ID인 경우 서버에 알림)
                if track_id not in counted_ids:
                    counted_ids.add(track_id)
                    threading.Thread(target=send_vehicle_pass, daemon=True).start()

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
                
                # Stage 1 임계치를 넘었는지 먼저 판단
                if c_sum <= CROSS_LIMIT_STAGE1:
                    current_stage = 1
                    
                    # Stage 1이 처음 감지된 시간을 기록
                    if track_id not in track_stage1_time:
                        track_stage1_time[track_id] = time.time()
                    
                    # Stage 2 임계치를 넘었는지 확인
                    if c_sum <= CROSS_LIMIT_STAGE2:
                        # Stage 1 발생 후 최소 3초가 지났을 때만 Stage 2로 승격 (사용자 피드백 반영)
                        elapsed = time.time() - track_stage1_time[track_id]
                        if elapsed >= 3.0:
                            current_stage = 2
                        else:
                            # 3초 이전이면 여전히 Stage 1로 유지하여 사용자에게 "경고"를 충분히 보여줌
                            current_stage = 1
                
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
                    # (카메라 뷰 박스 그리기 제거)
                    # 마지막 박스 정보 업데이트 (깜빡임 방지 및 라이다용)
                    track_last_box[track_id] = (x1, y1, x2, y2, color, label_text)
                else:
                    # 정상 차량은 박스 정보 삭제 (이전 프레임 잔상 제거)
                    track_last_box.pop(track_id, None)

                # 이벤트 전송 로직 (이미 해당 단계 알렸으면 패스)
                if current_stage > 0:
                    if current_stage not in track_alerted_stages[track_id]:
                        track_alerted_stages[track_id].add(current_stage)
                        # 팝업
                        threading.Thread(target=send_wrongway_alert, args=(track_id, current_stage, frame), daemon=True).start()
                        # 하드웨어 제어
                        if current_stage == 1:
                            send_serial(cmdScenario1, "시나리오1")
                            threading.Timer(3, lambda: send_serial(cmdScenario4, "리셋")).start()
                        elif current_stage == 2:
                            send_serial(cmdScenario2, "시나리오2")
                            threading.Timer(3, lambda: send_serial(cmdScenario3, "복귀")).start()
                            threading.Timer(3, lambda: send_serial(cmdScenario4, "리셋")).start()

        # 스테이터스 표시 (V4로 변경하여 확인)
        cv2.putText(annotated, f"YOLO V4 | CLEAN UI | PORT 8888", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        
        # 라이다 시각화 생성 (YOLO 실행 프레임)
        lidar_boxes = []
        if results and results[0].boxes is not None and results[0].boxes.id is not None:
            boxes_data = results[0].boxes
            ids_data = boxes_data.id.int().cpu().tolist()
            xyxys_data = boxes_data.xyxy.cpu().numpy()
            for i, tid in enumerate(ids_data):
                bx1, by1, bx2, by2 = xyxys_data[i]
                stage = track_stage.get(tid, 0)
                lidar_boxes.append((bx1, by1, bx2, by2, stage, tid))
        
        lv = generate_lidar_view(frame, lidar_boxes)
        with lidar_frame_lock:
            lidar_frame = lv
        
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


def generate_lidar_mjpeg():
    """라이다 시각화 MJPEG 프레임 제너레이터."""
    while True:
        with lidar_frame_lock:
            if lidar_frame is None:
                time.sleep(0.05)
                continue
            _, jpeg = cv2.imencode(
                ".jpg", lidar_frame, [cv2.IMWRITE_JPEG_QUALITY, 60]
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


@app.route("/lidar_feed")
def lidar_feed():
    """라이다 시각화 MJPEG 스트림 엔드포인트."""
    return Response(
        generate_lidar_mjpeg(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )

# 데모 모드 엔드포인트 (테스트용) - 실제 운영 시 제거 또는 비활성화 권장
@app.route("/demo/start", methods=["POST"])
def demo_start():
    global demo_active, demo_reset_requested
    demo_active = True
    demo_reset_requested = True
    reset_tracking_state()
    print("[demo] start", flush=True)
    return {"ok": True, "demo_active": demo_active}


@app.route("/demo/stop", methods=["POST"])
def demo_stop():
    global demo_active
    demo_active = False
    reset_tracking_state()
    print("[demo] stop", flush=True)
    return {"ok": True, "demo_active": demo_active}

@app.route("/demo/reset", methods=["POST"])
def demo_reset():
    global demo_active, demo_reset_requested
    demo_active = False
    demo_reset_requested = True
    reset_tracking_state()
    print("[demo] reset", flush=True)
    return {"ok": True, "demo_active": demo_active, "reset": True}
# ------------------------------

# 헬스체크 엔드포인트 (프레임 카운터 포함)
@app.route("/health")
def health():
    return {"ok": True, "frame": frame_counter}

# ── 메인 ───────────────────────────────────────
if __name__ == "__main__":
    print(f"[detector] 역주행 감지 서버 시작 (port {DETECTOR_PORT})")
    print(f"[detector] MJPEG 스트림: http://{DASHBOARD_IP}:{DETECTOR_PORT}/video_feed")

    # 감지 루프를 백그라운드 스레드로 시작
    det_thread = threading.Thread(target=detection_loop, daemon=True)
    det_thread.start()

    # Flask MJPEG 서버 시작
    app.run(host="0.0.0.0", port=DETECTOR_PORT, threaded=True)
