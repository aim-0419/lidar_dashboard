const {
  getDevices,
  getDeviceById,
  getDevicesByZone,
  getDeviceStatus,
} = require("./devices.service");
const { logger } = require("../../utils/logger");

// 전체 장비 목록 조회 요청을 받아 service 결과를 반환한다.
async function getDevicesController(req, res) {
  try {
    const devices = await getDevices();
    res.json({ success: true, data: { count: devices.length, devices }, message: "OK" });
  } catch (error) {
    logger.error("device list query failed", { error });

    res.status(503).json({
      success: false,
      error: {
        status: 503,
        code: "DEVICE_LIST_QUERY_FAILED",
        message: "장비 목록 조회에 실패했습니다.",
        details: [],
      },
    });
  }
}

// 장비 상세 조회 요청을 받아 소속 구역/현장을 포함한 상세 정보를 반환한다.
async function getDeviceByIdController(req, res) {
  const { id } = req.params;

  try {
    const device = await getDeviceById(id);

    if (!device) {
      return res.status(404).json({
        success: false,
        error: {
          status: 404,
          code: "DEVICE_NOT_FOUND",
          message: "해당 장비를 찾을 수 없습니다.",
          details: [],
        },
      });
    }

    res.json({ success: true, data: device, message: "OK" });
  } catch (error) {
    logger.error("device detail query failed", { error, deviceId: id });

    res.status(503).json({
      success: false,
      error: {
        status: 503,
        code: "DEVICE_DETAIL_QUERY_FAILED",
        message: "장비 상세 조회에 실패했습니다.",
        details: [],
      },
    });
  }
}

// 구역별 장비 목록 조회 요청을 받아 service 결과를 반환한다.
async function getDevicesByZoneController(req, res) {
  const { zoneId } = req.params;

  try {
    const devices = await getDevicesByZone(zoneId);

    if (devices === null) {
      return res.status(404).json({
        success: false,
        error: {
          status: 404,
          code: "ZONE_NOT_FOUND",
          message: "해당 구역을 찾을 수 없습니다.",
          details: [],
        },
      });
    }

    res.json({ success: true, data: { count: devices.length, devices }, message: "OK" });
  } catch (error) {
    logger.error("device list query by zone failed", { error, zoneId });

    res.status(503).json({
      success: false,
      error: {
        status: 503,
        code: "DEVICE_LIST_QUERY_FAILED",
        message: "장비 목록 조회에 실패했습니다.",
        details: [],
      },
    });
  }
}

// 장비 상태 조회 요청을 받아 상태 값만 반환한다.
async function getDeviceStatusController(req, res) {
  const { id } = req.params;

  try {
    const status = await getDeviceStatus(id);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: {
          status: 404,
          code: "DEVICE_NOT_FOUND",
          message: "해당 장비를 찾을 수 없습니다.",
          details: [],
        },
      });
    }

    res.json({ success: true, data: status, message: "OK" });
  } catch (error) {
    logger.error("device status query failed", { error, deviceId: id });

    res.status(503).json({
      success: false,
      error: {
        status: 503,
        code: "DEVICE_STATUS_QUERY_FAILED",
        message: "장비 상태 조회에 실패했습니다.",
        details: [],
      },
    });
  }
}

module.exports = {
  getDevicesController,
  getDeviceByIdController,
  getDevicesByZoneController,
  getDeviceStatusController,
};
