const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  adaptLidarHttpPayload,
  adaptLidarSnapshotPayload,
  normalizeTrackId,
} = require("../src/domains/wrongway/adapters/lidarHttp.adapter");

test("숫자 track_id는 문자열로 변환한다", () => {
  assert.equal(normalizeTrackId(9001), "9001");
});

test("숫자 0도 값이 있는 track_id로 보고 문자열로 변환한다", () => {
  assert.equal(normalizeTrackId(0), "0");
});

test("문자열 track_id는 유지하고 앞뒤 공백만 제거한다", () => {
  assert.equal(normalizeTrackId("track-001"), "track-001");
  assert.equal(normalizeTrackId("  abc  "), "abc");
});

test("빈 값이나 문자열/숫자가 아닌 track_id는 undefined로 만들어 검증에서 거절되게 한다", () => {
  for (const value of [undefined, null, "", "   ", Number.NaN, Number.POSITIVE_INFINITY, true, {}, []]) {
    assert.equal(normalizeTrackId(value), undefined, `입력값: ${String(value)}`);
  }
});

test("objects 배열 payload의 숫자 track_id를 문자열로 변환한다", () => {
  const snapshot = adaptLidarSnapshotPayload({
    timestamp: "2026-10-06T10:00:00+09:00",
    source: "lidar-pc-01",
    total_objects: 2,
    objects: [
      { type: "wrong-way", zone_id: "zone-a", track_id: 9001 },
      { type: "normal-driving", zone_id: "zone-a", track_id: 0 },
    ],
  });

  assert.deepEqual(
    snapshot.objects.map((entry) => entry.event.trackId),
    ["9001", "0"],
  );
});

test("구형 단일 객체 payload의 숫자 track_id도 문자열로 변환한다", () => {
  const event = adaptLidarHttpPayload({
    type: "wrong-way",
    zone_id: "zone-a",
    track_id: 42,
  });

  assert.equal(event.trackId, "42");
});
