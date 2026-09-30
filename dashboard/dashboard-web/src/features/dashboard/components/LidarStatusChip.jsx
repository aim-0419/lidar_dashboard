import { CircleDot, WifiOff } from "lucide-react";
import { formatClockTime } from "../formatClockTime";

// 라이다 수신 상태를 표시한다. 수신이 끊기면 "차량 없음"과 구분되도록 빨간 경고로 바꾼다.
// lidar가 없으면(현황 조회 전) 아무것도 표시하지 않는다.
export function LidarStatusChip({ lidar }) {
  if (!lidar) return null;

  if (lidar.receiving) {
    return (
      <span className="ops-live-chip">
        <CircleDot size={13} />
        LIVE
      </span>
    );
  }

  return (
    <span
      className="ops-lidar-lost-chip"
      title={lidar.lastReceivedAt ? `마지막 수신 ${formatClockTime(lidar.lastReceivedAt)}` : "수신 기록 없음"}
    >
      <WifiOff size={13} />
      라이다 수신 끊김
    </span>
  );
}
