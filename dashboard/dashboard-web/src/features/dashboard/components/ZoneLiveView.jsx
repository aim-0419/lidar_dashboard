import { CctvFeed } from "./CctvFeed";
import { LidarStatusChip } from "./LidarStatusChip";
import { RoundaboutMap } from "./RoundaboutMap";
import { SampleDataBadge } from "./SampleDataBadge";

// 구역명, CCTV 목록, Lanelet 코드와 객체를 한 화면 단위로 묶어 표시한다.
export function ZoneLiveView({ zone, objects, lidar, isOverview, onSelectZone }) {
  return (
    <article className="ops-card ops-zone-live-view">
      <div className="ops-card-head">
        <div>
          <h2>{zone.name} 실시간 현장 화면</h2>
          <p>{zone.name} CCTV와 라이다 객체 위치</p>
        </div>
        <div className="ops-zone-live-actions">
          {/* 객체 수·종류는 실데이터지만, 라이다 좌표 규격이 없어 맵 위 위치는 임의 배치다. */}
          <SampleDataBadge label="위치 미연동" />
          <LidarStatusChip lidar={lidar} />
          {isOverview && (
            <button type="button" onClick={() => onSelectZone(zone.id)}>
              구역 상세
            </button>
          )}
        </div>
      </div>

      <div className="ops-visual-grid">
        <div className={`ops-cctv-grid ${zone.cameras.length === 1 ? "single" : ""}`}>
          {zone.cameras.map((camera) => (
            <CctvFeed key={camera.id} camera={camera} />
          ))}
        </div>

        <RoundaboutMap zone={zone} objects={objects} />
      </div>
    </article>
  );
}
