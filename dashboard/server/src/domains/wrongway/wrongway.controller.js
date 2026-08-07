const { logger } = require("../../utils/logger");
const mockLidarService = require("../mock-lidar/mockLidar.service");
const { createWrongwayErrorResponse } = require("./wrongway.dto");
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

    res
      .status(error.statusCode || 500)
      .json(createWrongwayErrorResponse(error, "역주행 데이터 수신 처리 중 오류가 발생했습니다."));
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

async function sendNormalDrivingTest(req, res) {
  try {
    const result = await wrongwayService.sendNormalDrivingTestPayload(req.body || {});
    res.json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(createWrongwayErrorResponse(error, "정주행 테스트 데이터 전송 중 오류가 발생했습니다."));
  }
}

function startNormalDrivingStream(req, res) {
  res.json(wrongwayService.startNormalDrivingStream(req.body || {}));
}

function stopNormalDrivingStream(req, res) {
  res.json(wrongwayService.stopNormalDrivingStream());
}

function getNormalDrivingStreamStatus(req, res) {
  res.json(wrongwayService.getNormalStreamStatus());
}

async function sendWrongWayLevel1Test(req, res) {
  try {
    const result = await wrongwayService.sendWrongWayLevel1TestPayload(req.body || {});
    res.status(result.result?.stored ? 201 : 200).json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(createWrongwayErrorResponse(error, "역주행 1차 테스트 데이터 전송 중 오류가 발생했습니다."));
  }
}

module.exports = {
  receiveWrongWay,
  getWrongWayHistory,
  getWrongWayTestPayloads,
  getNormalDrivingStreamStatus,
  sendNormalDrivingTest,
  sendWrongWayLevel1Test,
  startNormalDrivingStream,
  stopNormalDrivingStream,
};

