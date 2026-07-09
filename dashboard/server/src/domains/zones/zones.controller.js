const { getZones, getZonesBySite, getZoneById } = require("./zones.service");
const { logger } = require("../../utils/logger");

// 전체 구역 목록 조회 요청을 받아 service 결과를 반환한다.
async function getZonesController(req, res) {
  try {
    const zones = await getZones();
    res.json({ success: true, data: { count: zones.length, zones }, message: "OK" });
  } catch (error) {
    logger.error("zone list query failed", { error });

    res.status(503).json({
      success: false,
      error: {
        status: 503,
        code: "ZONE_LIST_QUERY_FAILED",
        message: "구역 목록 조회에 실패했습니다.",
        details: [],
      },
    });
  }
}

// 현장별 구역 목록 조회 요청을 받아 service 결과를 반환한다.
async function getZonesBySiteController(req, res) {
  const { siteId } = req.params;

  try {
    const zones = await getZonesBySite(siteId);

    if (zones === null) {
      return res.status(404).json({
        success: false,
        error: {
          status: 404,
          code: "SITE_NOT_FOUND",
          message: "해당 현장을 찾을 수 없습니다.",
          details: [],
        },
      });
    }

    res.json({ success: true, data: { count: zones.length, zones }, message: "OK" });
  } catch (error) {
    logger.error("zone list query failed", { error, siteId });

    res.status(503).json({
      success: false,
      error: {
        status: 503,
        code: "ZONE_LIST_QUERY_FAILED",
        message: "구역 목록 조회에 실패했습니다.",
        details: [],
      },
    });
  }
}

// 구역 상세 조회 요청을 받아 장비를 포함한 상세 정보를 반환한다.
async function getZoneByIdController(req, res) {
  const { id } = req.params;

  try {
    const zone = await getZoneById(id);

    if (!zone) {
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

    res.json({ success: true, data: zone, message: "OK" });
  } catch (error) {
    logger.error("zone detail query failed", { error, zoneId: id });

    res.status(503).json({
      success: false,
      error: {
        status: 503,
        code: "ZONE_DETAIL_QUERY_FAILED",
        message: "구역 상세 조회에 실패했습니다.",
        details: [],
      },
    });
  }
}

module.exports = {
  getZonesController,
  getZonesBySiteController,
  getZoneByIdController,
};
