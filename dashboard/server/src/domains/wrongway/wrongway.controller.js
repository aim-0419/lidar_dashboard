const { logger } = require("../../utils/logger");
const mockLidarService = require("../mock-lidar/mockLidar.service");
const wrongwayService = require("./wrongway.service");

async function receiveWrongWay(req, res) {
  try {
    const body = req.body || {};

    logger.info("wrongway payload received", {
      type: body.type,
      warningLevel: body.warning_level,
      zoneId: body.zone_id,
      trackId: body.track_id,
    });
    logger.debug("wrongway payload shape received", {
      payloadKeys: Object.keys(body),
      payloadSize: JSON.stringify(body).length,
    });

    const result = await wrongwayService.receiveWrongWayPayload(body);
    res.status(result.stored ? 201 : 200).json(result);
  } catch (error) {
    logger.error("wrongway payload failed", {
      message: error.message,
      details: error.details,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "역주행 데이터 수신 처리 중 오류가 발생했습니다.",
      details: error.details,
    });
  }
}

function getWrongWayHistory(req, res) {
  res.json(mockLidarService.getWrongWayHistory());
}

function getWrongWayTestPayloads(req, res) {
  const host = req.get("host") || "localhost:5000";
  const protocol = req.protocol || "http";
  res.json(wrongwayService.getTestPayloads(`${protocol}://${host}`));
}

module.exports = {
  receiveWrongWay,
  getWrongWayHistory,
  getWrongWayTestPayloads,
};
