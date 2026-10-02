// 이벤트 이력 화면과 대시보드가 같은 이벤트 이름·색상 기준을 쓰도록 공통으로 둔다.
export function eventTypeText(type) {
  if (type === "normal-driving") return "정주행";
  if (type === "wrong-way" || type === "wrong-way-level-1" || type === "wrong-way-level-2") return "역주행";
  if (type === "situation-ended") return "상황 종료";
  if (type === "pedestrian-entered") return "보행자 진입";
  if (type === "pedestrian-exited") return "보행자 이탈";
  return type;
}

export function eventTypeClass(type) {
  return type?.startsWith("wrong-way") ? "wrong-way" : type;
}
