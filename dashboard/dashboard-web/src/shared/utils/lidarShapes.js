/*
 * 감지 객체를 클래스에 맞는 형상으로 그리기 위한 정의.
 *
 * 라이다가 실제로 주는 건 바운딩 박스이지 차종 모델이 아니다.
 * 다만 objectClass로 차량·트럭·버스·보행자는 구분되므로, 그 구분을 형상으로 읽히게 한다.
 * 즉 여기 형상은 "측정된 외형"이 아니라 "클래스 기호"다.
 * 실제 감지 범위는 노면의 접지 표시가 계속 맡는다.
 *
 * 좌표는 로컬 기준이며 x가 진행 방향 길이, z가 폭, y가 높이다.
 * 단위는 노면 그리드와 같은 축척을 쓴다(주행 링 반지름이 60~90인 좌표계).
 * 실제 축척보다 크게 잡았다 — 실물 비율대로 두면 화면에서 점처럼 보여 클래스가 구분되지 않는다.
 */

export const OBJECT_CLASS = {
  VEHICLE: 1,
  TRUCK: 2,
  BUS: 3,
  PEDESTRIAN: 7,
};

/*
 * 차체는 옆면 윤곽선(프로필)을 폭 방향으로 밀어 만든다.
 * 상자를 쌓으면 아무리 붙여도 상자로 읽히지만,
 * 보닛에서 앞유리로 꺾이고 루프를 지나 트렁크로 떨어지는 선이 있으면 차로 읽힌다.
 *
 * profile : [x, y] 를 앞범퍼부터 시계 방향으로 한 바퀴
 * widths  : 각 프로필 점에서의 반폭 (루프를 좁히면 그린하우스가 생긴다)
 * shades  : 각 구간(면)의 밝기. 위를 향한 면일수록 밝게 준다.
 */
function extrudeProfile(profile, widths, shades) {
  const faces = [];
  const at = (index, side) => [
    profile[index][0],
    profile[index][1],
    widths[index] * side,
  ];

  // 겉면 — 프로필의 각 구간을 폭 방향으로 이어 붙인 띠.
  for (let index = 0; index < profile.length; index += 1) {
    const next = (index + 1) % profile.length;
    faces.push({
      shade: shades[index] ?? 0.6,
      points: [at(index, -1), at(next, -1), at(next, 1), at(index, 1)],
    });
  }

  // 좌우 옆면 — 프로필 전체를 그대로 덮는다.
  faces.push({
    shade: 0.5,
    points: profile.map((_, index) => at(index, -1)),
  });
  faces.push({
    shade: 0.44,
    points: profile.map((_, index) => at(index, 1)).reverse(),
  });

  return faces;
}

// 바퀴처럼 작은 덩어리는 직육면체로 충분하다.
function boxFaces({ x, y, z }, shadeScale = 1) {
  const [x0, x1] = x;
  const [y0, y1] = y;
  const [z0, z1] = z;
  const s = (value) => value * shadeScale;

  return [
    { shade: s(1), points: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] },
    { shade: s(0.72), points: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
    { shade: s(0.62), points: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]] },
    { shade: s(0.5), points: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]] },
    { shade: s(0.44), points: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y0, z1]] },
    { shade: s(0.3), points: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
  ];
}

// 네 바퀴. 차체보다 어둡게 깔아 접지면을 만든다.
function wheels(axleX, halfWidth, radius) {
  return axleX.flatMap((x) => [-1, 1].map((side) => boxFaces({
    x: [x - radius, x + radius],
    y: [0, radius * 2],
    z: [halfWidth * side - 0.9, halfWidth * side + 0.9],
  }, 0.42)).flat());
}

/*
 * 승용차 — 앞범퍼 → 보닛 → 앞유리 → 루프 → 뒷유리 → 트렁크 → 뒷범퍼.
 * 루프 쪽 반폭을 좁혀 유리면이 안쪽으로 눕도록 했다.
 */
const CAR_PROFILE = [
  [13.0, 2.2],
  [13.0, 5.0],
  [8.6, 6.4],
  [4.2, 6.8],
  [0.6, 10.2],
  [-6.0, 10.4],
  [-9.6, 7.0],
  [-13.0, 6.4],
  [-13.0, 2.2],
];
const CAR_WIDTHS = [5.6, 6.0, 6.2, 6.2, 5.0, 4.8, 5.4, 5.8, 5.6];
const CAR_SHADES = [0.42, 0.78, 0.88, 0.95, 1, 0.9, 0.7, 0.5, 0.34];

// 버스 — 앞이 거의 서 있고 루프가 길다.
const BUS_PROFILE = [
  [19.0, 2.6],
  [19.0, 12.6],
  [16.0, 14.2],
  [-16.0, 14.2],
  [-19.0, 12.6],
  [-19.0, 2.6],
];
const BUS_WIDTHS = [6.4, 6.8, 6.4, 6.4, 6.8, 6.4];
const BUS_SHADES = [0.4, 0.8, 0.95, 1, 0.72, 0.36];

// 트럭 — 낮은 운전실 뒤로 높은 적재함.
const TRUCK_PROFILE = [
  [14.0, 2.4],
  [14.0, 8.4],
  [10.0, 10.0],
  [4.0, 10.0],
  [4.0, 13.4],
  [-18.0, 13.4],
  [-18.0, 2.4],
];
const TRUCK_WIDTHS = [6.0, 6.2, 6.2, 6.2, 6.6, 6.6, 6.4];
const TRUCK_SHADES = [0.4, 0.78, 0.92, 0.6, 1, 0.7, 0.34];

const SHAPES = {
  car: {
    label: "차량",
    faces: [
      ...extrudeProfile(CAR_PROFILE, CAR_WIDTHS, CAR_SHADES),
      ...wheels([8.0, -8.0], 5.6, 2.4),
    ],
  },
  bus: {
    label: "버스",
    faces: [
      ...extrudeProfile(BUS_PROFILE, BUS_WIDTHS, BUS_SHADES),
      ...wheels([13.0, -12.0], 6.4, 2.8),
    ],
  },
  truck: {
    label: "트럭",
    faces: [
      ...extrudeProfile(TRUCK_PROFILE, TRUCK_WIDTHS, TRUCK_SHADES),
      ...wheels([9.5, -6.0, -13.5], 6.2, 2.6),
    ],
  },
  pedestrian: {
    label: "보행자",
    faces: [
      ...boxFaces({ x: [-2.6, 2.6], y: [0, 10], z: [-2.6, 2.6] }),
      ...boxFaces({ x: [-1.9, 1.9], y: [10, 13.5], z: [-1.9, 1.9] }),
    ],
  },
};

export function shapeForClass(objectClass) {
  if (objectClass === OBJECT_CLASS.PEDESTRIAN) return SHAPES.pedestrian;
  if (objectClass === OBJECT_CLASS.BUS) return SHAPES.bus;
  if (objectClass === OBJECT_CLASS.TRUCK) return SHAPES.truck;
  return SHAPES.car;
}

/*
 * 형상의 면 목록.
 * 그리는 쪽에서 깊이순으로 정렬해 뒤에서 앞으로 칠하면 된다.
 */
export function shapeFaces(shape) {
  return shape.faces;
}
