import { CircleDot } from "lucide-react";
import { CctvFeed } from "../../features/dashboard/components/CctvFeed";
import { RoundaboutMap } from "../../features/dashboard/components/RoundaboutMap";
import { detectedObjects, monitoringZones } from "../../shared/constants/operationsDashboardData";
import "../Dashboard/dashboard.css";
import "./liveView.css";

// 회전교차로별 CCTV와 라이다 벡터 맵을 4분할 큰 화면으로 보여주는 관제용 라이브 뷰다.
// 각 칸은 확대 버튼으로 전체화면으로도 볼 수 있다. 현재는 mock 데이터를 사용한다.
export default function LiveViewPage() {
  return (
    <div className="ops-page live-view-page">
      <header className="ops-header">
        <div>
          <p className="ops-kicker">Live View</p>
          <h1>라이브 뷰</h1>
          <p className="ops-subtitle">회전교차로별 CCTV와 라이다 벡터 맵을 4분할 화면으로 확인</p>
        </div>
        <span className="ops-live-chip">
          <CircleDot size={13} />
          LIVE
        </span>
      </header>

      <div className="live-view-grid">
        {monitoringZones.flatMap((zone) => {
          const zoneObjects = detectedObjects.filter((item) => item.monitoringZoneId === zone.id);

          return [
            <div className="live-view-cell" key={`${zone.id}-cctv`}>
              {zone.cameras.map((camera) => (
                <CctvFeed key={camera.id} camera={camera} />
              ))}
            </div>,
            <div className="live-view-cell" key={`${zone.id}-map`}>
              <RoundaboutMap zone={zone} objects={zoneObjects} />
            </div>,
          ];
        })}
      </div>
    </div>
  );
}
