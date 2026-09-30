// 대시보드 카드에 표시하는 시각(HH:MM:SS, 24시간)을 만든다.
export function formatClockTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
