const { config } = require("../../config");
const { logger } = require("../../utils/logger");
const mockLidarService = require("../mock-lidar/mockLidar.service");

async function startDemo(req, res) {
  try {
    const r = await fetch(`${config.detectorBaseUrl}/demo/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "detector demo start failed");

    mockLidarService.pushLog("Detector demo started");
    res.json({ ok: true, detector: data });
  } catch (err) {
    logger.error("detector demo start failed", { err });
    mockLidarService.pushLog(`Demo START failed: ${String(err.message || err)}`);
    res.status(500).json({ ok: false, error: "데모 시작 처리 중 오류가 발생했습니다." });
  }
}

async function resetDemo(req, res) {
  try {
    const r = await fetch(`${config.detectorBaseUrl}/demo/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "detector demo reset failed");

    mockLidarService.pushLog("Detector demo reset");
    mockLidarService.resetKpi();

    res.json({ ok: true, detector: data });
  } catch (err) {
    logger.error("detector demo reset failed", { err });
    mockLidarService.pushLog(`Demo RESET failed: ${String(err.message || err)}`);
    res.status(500).json({ ok: false, error: "데모 초기화 처리 중 오류가 발생했습니다." });
  }
}

module.exports = {
  startDemo,
  resetDemo,
};
