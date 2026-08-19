const { logger } = require("../../utils/logger");
const { createWrongwayErrorResponse } = require("./wrongway.dto");
const wrongwayService = require("./wrongway.service");

async function receiveWrongWay(req, res) {
  try {
    const body = req.body || {};

    logger.info("wrongway payload received", {
      source: body.source,
      status: body.status,
      totalObjects: body.total_objects,
      objectCount: Array.isArray(body.objects) ? body.objects.length : body.type ? 1 : 0,
    });
    logger.debug("wrongway payload shape received", {
      payloadKeys: Object.keys(body),
      payloadSize: JSON.stringify(body).length,
    });

    const result = await wrongwayService.receiveWrongWayPayload(body);
    res.status(result.summary?.eventsStored > 0 ? 201 : 200).json(result);
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

async function getWrongWayHistory(req, res) {
  try {
    const result = await wrongwayService.getEventHistory(req.query);
    res.json(result);
  } catch (error) {
    logger.error("wrongway history query failed", {
      message: error.message,
      details: error.details,
    });
    res
      .status(error.statusCode || 500)
      .json(createWrongwayErrorResponse(error, "이벤트 이력 조회 중 오류가 발생했습니다."));
  }
}

async function updateWrongWayEventStatus(req, res) {
  try {
    const result = await wrongwayService.updateEventStatus({
      eventId: req.params.id,
      status: req.body?.status,
      memo: req.body?.memo,
      userId: req.user.id,
    });
    res.json(result);
  } catch (error) {
    logger.error("wrongway event status update failed", {
      eventId: req.params.id,
      userId: req.user?.id,
      message: error.message,
      details: error.details,
    });
    res
      .status(error.statusCode || 500)
      .json(createWrongwayErrorResponse(error, "이벤트 상태 변경 중 오류가 발생했습니다."));
  }
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

async function sendWrongWayTest(req, res) {
  try {
    const result = await wrongwayService.sendWrongWayTestPayload(req.body || {});
    res.status(result.result?.summary?.eventsStored > 0 ? 201 : 200).json(result);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(createWrongwayErrorResponse(error, "역주행 테스트 데이터 전송 중 오류가 발생했습니다."));
  }
}

module.exports = {
  receiveWrongWay,
  getWrongWayHistory,
  updateWrongWayEventStatus,
  getWrongWayTestPayloads,
  getNormalDrivingStreamStatus,
  sendNormalDrivingTest,
  sendWrongWayTest,
  startNormalDrivingStream,
  stopNormalDrivingStream,
};
