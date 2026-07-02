const { getSites, getSiteById } = require("./sites.service");
const { logger } = require("../../utils/logger");

// 현장 목록 조회 요청을 받아 service 결과를 반환한다.
async function getSitesController(req, res) {
  try {
    const sites = await getSites();
    res.json({ success: true, data: { count: sites.length, sites }, message: "OK" });
  } catch (error) {
    logger.error("site list query failed", { error });

    res.status(503).json({
      success: false,
      error: {
        status: 503,
        code: "SITE_LIST_QUERY_FAILED",
        message: "현장 목록 조회에 실패했습니다.",
        details: [],
      },
    });
  }
}

// 현장 상세 조회 요청을 받아 존/디바이스를 포함한 상세 정보를 반환한다.
async function getSiteByIdController(req, res) {
  const { id } = req.params;

  try {
    const site = await getSiteById(id);

    if (!site) {
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

    res.json({ success: true, data: site, message: "OK" });
  } catch (error) {
    logger.error("site detail query failed", { error, siteId: id });

    res.status(503).json({
      success: false,
      error: {
        status: 503,
        code: "SITE_DETAIL_QUERY_FAILED",
        message: "현장 상세 조회에 실패했습니다.",
        details: [],
      },
    });
  }
}

module.exports = { getSitesController, getSiteByIdController };