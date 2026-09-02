/*
 * LIDAR OPS 브랜드 마크이다. 정주행 화살표와 역주행 화살표를 겹쳐 제품이 무엇을 잡아내는지를 형태로 보여준다.
 * 사이드바·로그인 브랜드 타일과 파비콘이 같은 마크를 쓰도록 한 곳에서만 관리한다.
 *
 * 작은 크기에서는 화살촉 세 개의 간격이 1px 남짓으로 좁혀져 뭉치므로,
 * COMPACT_BELOW 미만에서는 화살표를 두 개로 줄인 축약형으로 자동 전환한다.
 * 크기를 바꾸는 쪽이 아니라 형태를 바꾸는 쪽을 택한 이유는 브랜드 타일 크기가 레이아웃에 묶여 있기 때문이다.
 */

// 이 값 미만이면 축약형을 쓴다. 사이드바(15) · 파비콘(10)이 축약형, 로그인(22) 이상이 원본이다.
const COMPACT_BELOW = 20;

// 역주행 화살표 색이다. 어두운 브랜드 타일 위에서도 읽히도록 밝은 톤을 쓴다.
const WRONGWAY_STROKE = { stroke: "var(--tone-wrongway-lit, #ff7a7e)" };

export function BrandMark({ size = 24, title, className = "" }) {
  const isCompact = size < COMPACT_BELOW;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={isCompact ? 2.4 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: "block" }}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : "true"}
    >
      {isCompact ? (
        <>
          {/* 축약형: 정주행 1 + 역주행 1. 화살촉 간격을 벌리고 획을 굵혀 작은 크기에서 뭉치지 않게 한다. */}
          <path d="M7.5 20 V6" />
          <path d="M4.3 9.2 L7.5 6 L10.7 9.2" />
          <path d="M16.5 4 V18" style={WRONGWAY_STROKE} />
          <path d="M13.3 14.8 L16.5 18 L19.7 14.8" style={WRONGWAY_STROKE} />
        </>
      ) : (
        <>
          {/* 원본: 정주행 2 + 역주행 1. 흐름 속에 하나만 거슬러 올라가는 구성이다. */}
          <path d="M5 20 V6" />
          <path d="M2.4 8.6 L5 6 L7.6 8.6" />
          <path d="M12 20 V6" />
          <path d="M9.4 8.6 L12 6 L14.6 8.6" />
          <path d="M19 4 V18" style={WRONGWAY_STROKE} />
          <path d="M16.4 15.4 L19 18 L21.6 15.4" style={WRONGWAY_STROKE} />
        </>
      )}
    </svg>
  );
}

export default BrandMark;
