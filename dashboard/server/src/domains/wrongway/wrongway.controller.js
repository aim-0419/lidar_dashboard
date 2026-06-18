const { nowTime } = require("../../utils/time");
const mockLidarService = require("../mock-lidar/mockLidar.service");

function receiveWrongWay(req, res) {
  const body = req.body || {};
  console.log("[wrongway hit]", new Date().toISOString(), body);

  const alert = {
    id: body.id || `evt-${Date.now()}`,
    type: "wrong-way",
    stage: Number(body.stage) || 1,
    message: "WRONG WAY DETECTION",
    subMessage: body.message || `Zone: ${body.zone_id || "UNKNOWN"}`,
    timestamp: body.timestamp
      ? new Date(body.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : nowTime(),
    zone_id: body.zone_id,
    track_id: body.track_id,
    confidence: body.confidence,
    video_ts_ms: body.video_ts_ms,
    device_id: body.device_id,
    serial_no: body.serial_no,
    snapshot: body.snapshot,
  };

  console.log("[broadcast alert]", alert);

  mockLidarService.applyAlertEffects(alert);
  mockLidarService.addWrongWayHistory(alert);
  mockLidarService.broadcastAlert(alert);
  mockLidarService.pushLog(`[WRONGWAY] ${alert.subMessage}`);

  res.json({ ok: true });
}

function getWrongWayHistory(req, res) {
  res.json(mockLidarService.getWrongWayHistory());
}

module.exports = {
  receiveWrongWay,
  getWrongWayHistory,
};