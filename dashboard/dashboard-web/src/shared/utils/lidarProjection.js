/*
 * 라이다 장면을 캔버스에 3D로 그리기 위한 공용 투영 유틸이다.
 * 외부 3D 라이브러리 없이 좌표를 직접 투영하므로 의존성이 늘지 않는다.
 *
 * 월드 좌표계는 노면을 XZ 평면으로 두고 Y를 높이로 쓴다.
 * 회전교차로 중심이 원점이며 단위는 대략 1 = 10cm 축척이다.
 */

export const TAU = Math.PI * 2;

/*
 * 카메라는 원점을 바라보며 elevation 만큼 올라가 distance 만큼 물러나 있다.
 * 각도가 프레임 안에서는 고정이므로 삼각함수를 한 번만 계산해 두고
 * 점마다 곱셈만 하도록 클로저로 묶는다. 점이 수천 개일 때 체감 차이가 크다.
 *
 * 화면 좌표는 아래로 갈수록 커지므로, 카메라에 가까운 지면일수록 아래에 온다.
 * focal은 초점거리이며 클수록 화면에 크게 잡힌다. fitFocal로 구하면 잘리지 않는다.
 */
export function createProjector({
  width,
  height,
  cameraAngle = 0,
  elevation = 1.02,
  // 카메라가 원점에서 얼마나 물러나 있는지. 값이 작을수록 원근이 강해진다.
  distance = 240,
  focal = 240,
  // 화면 세로에서 원점(교차로 중심)이 놓이는 비율.
  horizon = 0.5,
  // 화면 가로에서 원점이 놓이는 비율. 오른쪽에 패널이 겹치는 레이아웃에서 왼쪽으로 민다.
  anchorX = 0.5,
}) {
  const cos = Math.cos(cameraAngle);
  const sin = Math.sin(cameraAngle);
  const cosElev = Math.cos(elevation);
  const sinElev = Math.sin(elevation);
  const centerX = width * anchorX;
  const centerY = height * horizon;

  return function project(x, y, z) {
    const rotatedX = x * cos - z * sin;
    const rotatedZ = x * sin + z * cos;

    // 카메라 좌표계: 위쪽 성분과 앞쪽(깊이) 성분.
    const upward = y * cosElev + rotatedZ * sinElev;
    const forward = rotatedZ * cosElev - y * sinElev + distance;

    // 카메라 뒤로 넘어간 점은 그리지 않는다.
    if (forward <= 1) return null;

    const perspective = focal / forward;

    return {
      x: centerX + rotatedX * perspective,
      y: centerY - upward * perspective,
      depth: forward,
      scale: perspective,
    };
  };
}

/*
 * 반지름 radius 인 원판이 캔버스 안에 딱 들어가는 초점거리와 세로 중심을 구한다.
 * 카드 폭이 어떻게 바뀌어도 교차로가 잘리거나 쪼그라들지 않게 하려고 쓴다.
 */
export function fitFocal({ width, height, radius, elevation = 1.02, distance = 240, margin = 0.14 }) {
  const cosElev = Math.cos(elevation);
  const sinElev = Math.sin(elevation);

  // 카메라 평면보다 앞으로 나온 원판은 투영이 발산하므로 반지름을 제한한다.
  const safeRadius = Math.min(radius, (distance / cosElev) * 0.72);

  const farDepth = safeRadius * cosElev + distance;
  const nearDepth = distance - safeRadius * cosElev;

  // 초점거리 1일 때의 원판 크기.
  const unitTop = (safeRadius * sinElev) / farDepth;
  const unitBottom = (safeRadius * sinElev) / nearDepth;
  const unitHeight = unitTop + unitBottom;
  // 가로로 가장 넓어지는 지점은 앞쪽으로 조금 치우치므로 그만큼 여유를 둔다.
  const unitWidth = (2 * safeRadius) / (distance - safeRadius * cosElev * 0.5);

  const focal = Math.min(
    (height * (1 - margin)) / unitHeight,
    (width * (1 - margin)) / unitWidth,
  );

  // 원판의 위아래 한가운데가 캔버스 한가운데에 오도록 원점을 내려 잡는다.
  const offset = ((unitBottom - unitTop) / 2) * focal;
  const horizon = (height / 2 - offset) / height;

  return { focal, horizon, radius: safeRadius };
}

/*
 * 회전교차로 모양의 포인트 클라우드를 만든다.
 * 안쪽 원(교통섬)과 바깥 링(주행로)에 점을 나눠 배치하고,
 * 노면 위 약간의 높이 편차로 스캔 노이즈를 표현한다.
 */
export function buildPointCloud(pointCount, options = {}) {
  const {
    islandRatio = 0.28,
    islandRadius = [12, 38],
    ringRadius = [46, 108],
    islandHeight = 7,
    ringHeight = 2.2,
  } = options;

  const points = [];

  for (let index = 0; index < pointCount; index += 1) {
    const isIsland = index / pointCount < islandRatio;
    const [minRadius, maxRadius] = isIsland ? islandRadius : ringRadius;
    // sqrt를 씌워야 넓이 기준으로 고르게 퍼진다. 안 그러면 중심에 몰린다.
    const radius = minRadius + Math.sqrt(Math.random()) * (maxRadius - minRadius);
    const angle = Math.random() * TAU;

    points.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      y: (Math.random() - 0.5) * (isIsland ? islandHeight : ringHeight),
      radius,
      angle,
      seed: Math.random(),
    });
  }

  return points;
}

// 객체를 감싸는 직육면체(바운딩 박스)의 꼭짓점과 모서리.
export const BOX_CORNERS = [
  [-7, 0, -3.4],
  [7, 0, -3.4],
  [7, 0, 3.4],
  [-7, 0, 3.4],
  [-7, 6, -3.4],
  [7, 6, -3.4],
  [7, 6, 3.4],
  [-7, 6, 3.4],
];

export const BOX_EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/*
 * 스캔선이 방금 지나간 각도인지 0~1로 돌려준다.
 * 1에 가까울수록 막 훑고 지나간 자리라 밝게 그린다.
 */
export function sweepHeat(angle, sweepAngle, falloff = 0.55) {
  let delta = Math.abs(((angle - sweepAngle + Math.PI * 3) % TAU) - Math.PI);
  delta = Math.PI - delta;
  return Math.max(0, 1 - delta / falloff);
}

/*
 * 문자열을 0~1 사이 값으로 바꾼다(FNV-1a).
 * trackId처럼 고정된 식별자에서 흔들리지 않는 배치를 뽑을 때 쓴다.
 * Math.random을 쓰면 리렌더마다 객체가 순간이동한다.
 */
export function hashUnit(value) {
  const text = String(value ?? "");
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }

  return (hash >>> 0) / 4294967295;
}
