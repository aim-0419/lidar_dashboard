import { useEffect, useRef } from "react";

import { TAU, createProjector, fitFocal } from "../../../shared/utils/lidarProjection";
import { OBJECT_CLASS, shapeFaces, shapeForClass } from "../../../shared/utils/lidarShapes";

/*
 * 로그인 화면 전체를 덮는 회전교차로 관제 장면.
 *
 * 보는 사람이 도로 관계자이므로 도로가 도로로 읽혀야 한다.
 * 그래서 차선·교통섬·진입로·정지선을 선으로 또렷하게 깔고,
 * 라이다 포인트는 그 위를 훑는 보조 레이어로 둔다.
 * 감지는 점이 아니라 바운딩 브래킷과 트랙 라벨이 말한다.
 *
 * 이야기 한 바퀴 —
 *   평온하게 돌다 → 한 대가 역방향으로 돈다 → 스캔이 잡아낸다 → 경고 → 다시 평온.
 */

const SWEEP_PERIOD = 5.2;
const GROUND_DECAY = 4.8;
const LOCK_HOLD = 2.2;

const STORY_LOOP = 22;
const WRONG_WAY_AT = 8;
const DETECT_AT = 11.5;
const ALERT_UNTIL = 17.5;

const ELEVATION = 0.62;
const CAMERA_DISTANCE = 430;

// 회전교차로 치수(장면 좌표계). 소형 회전교차로 비율을 대략 따른다.
const ISLAND_R = 34; // 교통섬
const INNER_R = 48; // 주행로 안쪽 연석
const OUTER_R = 104; // 주행로 바깥 연석
const LANE_MID = 76; // 차로 구분 파선
const APPROACH = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const APPROACH_HALF = 21; // 진입로 반폭
const APPROACH_END = 182;
const SCENE_RADIUS = APPROACH_END;

/*
 * 라이다 반사점은 노면 위에 얇게 깐다.
 * 주인공이 아니므로 수를 줄이고 크기도 작게 잡는다.
 */
function buildGround(count) {
  const points = [];

  for (let index = 0; index < count; index += 1) {
    const kind = index % 10;
    let x;
    let z;

    if (kind < 6) {
      const radius = INNER_R + Math.sqrt(Math.random()) * (OUTER_R - INNER_R);
      const angle = Math.random() * TAU;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
    } else if (kind < 7) {
      const radius = Math.sqrt(Math.random()) * ISLAND_R;
      const angle = Math.random() * TAU;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
    } else {
      const road = APPROACH[Math.floor(Math.random() * APPROACH.length)];
      const along = OUTER_R + Math.random() * (APPROACH_END - OUTER_R);
      const across = (Math.random() - 0.5) * 2 * APPROACH_HALF;
      x = Math.cos(road) * along - Math.sin(road) * across;
      z = Math.sin(road) * along + Math.cos(road) * across;
    }

    points.push({ x, z, angle: Math.atan2(z, x), seed: Math.random() });
  }

  return points;
}

/*
 * 차량은 차로 위를 돈다. 안쪽 차로 62, 바깥 차로 90.
 * 출발 각도를 네 방향에 90도씩 벌려 한쪽에 몰리지 않게 한다.
 * 속도도 조금씩 달리해서 시간이 지나도 뭉치지 않는다.
 */
const VEHICLES = [
  { track: "TRK-11", kmh: 28.4, radius: 90, speed: 0.26, offset: 0, objectClass: OBJECT_CLASS.VEHICLE },
  { track: "TRK-07", kmh: 19.2, radius: 62, speed: 0.21, offset: Math.PI / 2, objectClass: OBJECT_CLASS.BUS },
  { track: "TRK-23", kmh: 31.6, radius: 90, speed: 0.30, offset: Math.PI, objectClass: OBJECT_CLASS.VEHICLE },
  { track: "TRK-04", kmh: 13.3, radius: 62, speed: 0.24, offset: -Math.PI / 2, objectClass: OBJECT_CLASS.VEHICLE, isActor: true },
].map((vehicle) => ({
  ...vehicle,
  faces: shapeFaces(shapeForClass(vehicle.objectClass)),
  sweptAt: null,
}));

export function LoginScanField({ className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d");
    const ground = buildGround(1500);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    let width = 0;
    let height = 0;
    let frameId = 0;
    let lastBeam = 0;
    const startedAt = performance.now();

    VEHICLES.forEach((vehicle) => {
      vehicle.sweptAt = null;
    });

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    // 지면 위 원을 화면 경로로 만든다. 원근이 걸리므로 점을 이어 그린다.
    function circlePath(project, radius, from = 0, to = TAU) {
      const steps = 84;
      context.beginPath();
      let started = false;

      for (let step = 0; step <= steps; step += 1) {
        const angle = from + ((to - from) * step) / steps;
        const at = project(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        if (!at) continue;
        if (!started) {
          context.moveTo(at.x, at.y);
          started = true;
        } else {
          context.lineTo(at.x, at.y);
        }
      }
    }

    function segment(project, ax, az, bx, bz) {
      const a = project(ax, 0, az);
      const b = project(bx, 0, bz);
      if (!a || !b) return;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }

    /*
     * 도면 — 이 장면에서 가장 먼저 읽혀야 하는 층.
     * 연석은 실선, 차로 구분은 파선, 진입로에는 양보 정지선을 둔다.
     */
    function drawRoad(project) {
      circlePath(project, ISLAND_R);
      context.closePath();
      context.fillStyle = "rgba(18, 160, 119, 0.10)";
      context.fill();
      context.strokeStyle = "rgba(63, 199, 156, 0.34)";
      context.lineWidth = 1.2;
      context.stroke();

      context.strokeStyle = "rgba(143, 187, 245, 0.40)";
      context.lineWidth = 1.3;
      circlePath(project, INNER_R);
      context.stroke();
      circlePath(project, OUTER_R);
      context.stroke();

      // 차로 구분 파선
      context.strokeStyle = "rgba(143, 187, 245, 0.26)";
      context.lineWidth = 1;
      for (let index = 0; index < 40; index += 1) {
        const from = (index / 40) * TAU;
        circlePath(project, LANE_MID, from, from + 0.055);
        context.stroke();
      }

      APPROACH.forEach((road) => {
        const cos = Math.cos(road);
        const sin = Math.sin(road);
        const at = (along, across) => [cos * along - sin * across, sin * along + cos * across];

        // 진입로 연석
        context.strokeStyle = "rgba(143, 187, 245, 0.34)";
        context.lineWidth = 1.2;
        [-APPROACH_HALF, APPROACH_HALF].forEach((across) => {
          const [ax, az] = at(OUTER_R - 2, across);
          const [bx, bz] = at(APPROACH_END, across);
          segment(project, ax, az, bx, bz);
        });

        // 중앙 파선
        context.strokeStyle = "rgba(143, 187, 245, 0.2)";
        context.lineWidth = 1;
        for (let seg = 0; seg < 6; seg += 1) {
          const start = OUTER_R + 8 + seg * 13;
          const [ax, az] = at(start, 0);
          const [bx, bz] = at(start + 7, 0);
          segment(project, ax, az, bx, bz);
        }

        // 양보 정지선 — 진입 차로 쪽에만 긋는다.
        context.strokeStyle = "rgba(143, 187, 245, 0.5)";
        context.lineWidth = 2;
        const [sx, sz] = at(OUTER_R + 5, -APPROACH_HALF + 2);
        const [ex, ez] = at(OUTER_R + 5, -1);
        segment(project, sx, sz, ex, ez);
      });

      context.lineWidth = 1;
    }

    function ageSinceSweep(angle, beamAngle) {
      const rel = ((beamAngle - angle) % TAU + TAU) % TAU;
      return (rel / TAU) * SWEEP_PERIOD;
    }

    function vehiclePose(vehicle, elapsed, storyT) {
      const reversed = vehicle.isActor && storyT > WRONG_WAY_AT;
      let angle = vehicle.offset + elapsed * vehicle.speed;

      if (reversed) {
        const loopStart = elapsed - storyT;
        const angleAtFlip = vehicle.offset + (loopStart + WRONG_WAY_AT) * vehicle.speed;
        angle = angleAtFlip - (storyT - WRONG_WAY_AT) * vehicle.speed;
      }

      return {
        angle,
        x: Math.cos(angle) * vehicle.radius,
        z: Math.sin(angle) * vehicle.radius,
        heading: angle + (reversed ? -1 : 1) * (Math.PI / 2),
        reversed,
      };
    }

    /*
     * 감지 표시 — 네 모서리 브래킷과 트랙 라벨.
     * 기관 화면이라 번짐 없이 선과 글자로만 말한다.
     */
    function drawLock(box, vehicle, rgb, lockAge, flagged) {
      const alpha = Math.max(0, Math.min(1, 1 - (lockAge - (LOCK_HOLD - 0.6)) / 0.6));
      if (alpha <= 0) return;

      const snapIn = Math.max(0, 1 - lockAge / 0.24);
      const pad = 6 + snapIn * 10;
      const left = box.minX - pad;
      const right = box.maxX + pad;
      const top = box.minY - pad;
      const bottom = box.maxY + pad;
      const arm = Math.max(6, Math.min(right - left, bottom - top) * 0.3);

      context.strokeStyle = `rgba(${rgb}, ${alpha * (flagged ? 0.95 : 0.7)})`;
      context.lineWidth = flagged ? 1.7 : 1.2;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(left, top + arm); context.lineTo(left, top); context.lineTo(left + arm, top);
      context.moveTo(right - arm, top); context.lineTo(right, top); context.lineTo(right, top + arm);
      context.moveTo(right, bottom - arm); context.lineTo(right, bottom); context.lineTo(right - arm, bottom);
      context.moveTo(left + arm, bottom); context.lineTo(left, bottom); context.lineTo(left, bottom - arm);
      context.stroke();
      context.lineWidth = 1;
      context.lineCap = "butt";

      const label = flagged
        ? `${vehicle.track} · 역주행`
        : `${vehicle.track} · ${vehicle.kmh.toFixed(1)} km/h`;
      context.font = '600 10.5px "Pretendard Variable", Pretendard, system-ui, sans-serif';
      const boxWidth = context.measureText(label).width + 12;
      const labelY = top - 20;

      context.beginPath();
      if (typeof context.roundRect === "function") context.roundRect(left, labelY, boxWidth, 16, 4);
      else context.rect(left, labelY, boxWidth, 16);
      context.fillStyle = flagged
        ? `rgba(88, 18, 24, ${alpha * 0.92})`
        : `rgba(7, 22, 38, ${alpha * 0.86})`;
      context.fill();
      context.strokeStyle = `rgba(${rgb}, ${alpha * 0.55})`;
      context.stroke();

      context.fillStyle = `rgba(${rgb}, ${alpha})`;
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(label, left + 6, labelY + 8);
    }

    function draw(now) {
      const elapsed = reduceMotion ? 6 : (now - startedAt) / 1000;
      const storyT = elapsed % STORY_LOOP;
      const beamAngle = reduceMotion ? 1.1 : ((elapsed / SWEEP_PERIOD) * TAU) % TAU;
      const alerting = storyT > DETECT_AT && storyT < ALERT_UNTIL;

      const fit = fitFocal({
        width,
        height,
        radius: SCENE_RADIUS,
        elevation: ELEVATION,
        distance: CAMERA_DISTANCE,
        margin: 0.06,
      });
      const project = createProjector({
        width,
        height,
        // 배경이 돌면 로그인 폼에서 시선을 뺏는다. 미세하게만 흔든다.
        cameraAngle: -0.5 + Math.sin(elapsed * 0.045) * 0.05,
        elevation: ELEVATION,
        distance: CAMERA_DISTANCE,
        focal: fit.focal,
        horizon: fit.horizon,
      });

      context.clearRect(0, 0, width, height);

      drawRoad(project);

      // 스캔 빔 — 도면을 덮지 않게 아주 옅게.
      const origin = project(0, 0, 0);
      const tip = project(Math.cos(beamAngle) * SCENE_RADIUS, 0, Math.sin(beamAngle) * SCENE_RADIUS);
      if (origin && tip) {
        context.beginPath();
        context.moveTo(origin.x, origin.y);
        for (let step = 0; step <= 16; step += 1) {
          const angle = beamAngle - (step / 16) * 0.42;
          const at = project(Math.cos(angle) * SCENE_RADIUS, 0, Math.sin(angle) * SCENE_RADIUS);
          if (at) context.lineTo(at.x, at.y);
        }
        context.closePath();
        const wedge = context.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, height);
        wedge.addColorStop(0, "rgba(94, 154, 235, 0.13)");
        wedge.addColorStop(1, "rgba(94, 154, 235, 0)");
        context.fillStyle = wedge;
        context.fill();

        context.beginPath();
        context.moveTo(origin.x, origin.y);
        context.lineTo(tip.x, tip.y);
        const beam = context.createLinearGradient(origin.x, origin.y, tip.x, tip.y);
        beam.addColorStop(0, "rgba(160, 210, 255, 0.45)");
        beam.addColorStop(1, "rgba(160, 210, 255, 0)");
        context.strokeStyle = beam;
        context.lineWidth = 1.4;
        context.stroke();
        context.lineWidth = 1;
      }

      // 라이다 반사점 — 도면 위를 훑는 보조 레이어.
      for (let index = 0; index < ground.length; index += 1) {
        const point = ground[index];
        const age = ageSinceSweep(point.angle, beamAngle);
        if (age > GROUND_DECAY) continue;

        const at = project(point.x, 0, point.z);
        if (!at) continue;

        const life = 1 - age / GROUND_DECAY;
        const alpha = (0.06 + 0.42 * life * life) * (0.6 + point.seed * 0.4);
        context.fillStyle = `rgba(120, 176, 240, ${alpha})`;
        context.beginPath();
        context.arc(at.x, at.y, Math.max(0.5, at.scale * 0.85), 0, TAU);
        context.fill();
      }

      /*
       * 차량 — 도로 위를 계속 달린다.
       * 스캔이 막 훑고 간 차량만 또렷해지고 감지 브래킷이 물린다.
       * 훑을 때만 그리면 대부분의 시간에 도로가 비어 보여서, 항상 그리되 밝기로 구분한다.
       */
      VEHICLES.forEach((vehicle) => {
        const pose = vehiclePose(vehicle, elapsed, storyT);
        const normalized = ((pose.angle % TAU) + TAU) % TAU;
        const swept = lastBeam > beamAngle
          ? normalized >= lastBeam || normalized <= beamAngle
          : normalized >= lastBeam && normalized <= beamAngle;

        if (swept) vehicle.sweptAt = elapsed;

        const sinceSweep = vehicle.sweptAt == null ? Infinity : elapsed - vehicle.sweptAt;
        const fresh = Math.max(0, 1 - sinceSweep / LOCK_HOLD);
        const flagged = vehicle.isActor && alerting;
        const rgb = flagged ? "255, 122, 126" : "168, 216, 255";
        // 스캔이 지난 직후엔 또렷하고, 시간이 지나면 은은하게 남는다.
        const weight = 0.42 + 0.58 * fresh;

        const cosH = Math.cos(pose.heading);
        const sinH = Math.sin(pose.heading);
        const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        const drawn = [];

        vehicle.faces.forEach((face) => {
          const points = [];
          for (const [cx, cy, cz] of face.points) {
            const at = project(
              pose.x + cx * cosH - cz * sinH,
              cy,
              pose.z + cx * sinH + cz * cosH,
            );
            if (!at) return;
            points.push(at);
            if (at.x < box.minX) box.minX = at.x;
            if (at.x > box.maxX) box.maxX = at.x;
            if (at.y < box.minY) box.minY = at.y;
            if (at.y > box.maxY) box.maxY = at.y;
          }
          const depth = points.reduce((sum, at) => sum + at.depth, 0) / points.length;
          drawn.push({ points, depth, shade: face.shade });
        });

        if (drawn.length === 0) return;
        // 뒤에서 앞으로 칠해야 가까운 면이 위에 온다.
        drawn.sort((a, b) => b.depth - a.depth);

        drawn.forEach((face) => {
          context.beginPath();
          face.points.forEach((at, index) => {
            if (index === 0) context.moveTo(at.x, at.y);
            else context.lineTo(at.x, at.y);
          });
          context.closePath();
          context.fillStyle = `rgba(${rgb}, ${0.28 * face.shade * weight})`;
          context.fill();
          context.strokeStyle = `rgba(${rgb}, ${Math.min(1, 0.85 * Math.max(face.shade, 0.5) * weight)})`;
          context.lineWidth = fresh > 0.5 ? 1.1 : 0.85;
          context.stroke();
        });
        context.lineWidth = 1;

        if (sinceSweep < LOCK_HOLD && box.maxX > box.minX) {
          drawLock(box, vehicle, rgb, sinceSweep, flagged);
        }

        // 역주행 경고 — 은은한 링 하나로 절제한다.
        if (vehicle.isActor && alerting) {
          const base = project(pose.x, 0, pose.z);
          if (base) {
            const beat = ((storyT - DETECT_AT) % 1.6) / 1.6;
            context.beginPath();
            context.ellipse(
              base.x,
              base.y,
              (16 + beat * 40) * base.scale,
              (6 + beat * 16) * base.scale,
              0,
              0,
              TAU,
            );
            context.strokeStyle = `rgba(255, 122, 126, ${(1 - beat) * 0.5})`;
            context.lineWidth = 1.4;
            context.stroke();
            context.lineWidth = 1;
          }
        }
      });

      lastBeam = beamAngle;
      if (!reduceMotion) frameId = window.requestAnimationFrame(draw);
    }

    resize();
    draw(performance.now());

    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(performance.now());
    });
    observer.observe(canvas);

    function handleVisibility() {
      if (reduceMotion) return;
      if (document.hidden) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      } else if (!frameId) {
        frameId = window.requestAnimationFrame(draw);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={`login-scan-field ${className}`.trim()} aria-hidden="true" />;
}

export default LoginScanField;
