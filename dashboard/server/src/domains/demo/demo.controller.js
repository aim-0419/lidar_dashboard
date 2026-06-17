const { config } = require("../../config");
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
    console.error("[demo/start]", err);
    mockLidarService.pushLog(`Demo START failed: ${String(err.message || err)}`);
    res.status(500).json({ ok: false, error: String(err.message || err) });
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
    console.error("[demo/reset]", err);
    mockLidarService.pushLog(`Demo RESET failed: ${String(err.message || err)}`);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}

module.exports = {
  startDemo,
  resetDemo,
};