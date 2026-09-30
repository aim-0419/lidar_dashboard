// 아직 실데이터 API가 연결되지 않아 목업 값을 보여주는 영역에 붙이는 표시다.
// 관제자가 샘플 값을 실제 현장 상황으로 오해하지 않도록 한다.
export function SampleDataBadge({ label = "샘플 데이터" }) {
  return <span className="ops-sample-badge">{label}</span>;
}
