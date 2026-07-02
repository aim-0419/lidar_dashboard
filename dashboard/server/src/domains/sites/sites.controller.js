const { getSites } = require("./sites.service");
const { logger } = require("../../utils/logger");

// 현장 목록 조회 요청을 받아 service 결과를 반환한다.
async function getSitesController(req, res) {
  try {
    const sites = await getSites();
    res.json({ ok: true, count: sites.length, sites });
  } catch (error) {
    logger.error("site list query failed", { error });

    res.status(503).json({
      ok: false,
      message: "현장 목록 조회에 실패했습니다.",
    });
  }
}

module.exports = { getSitesController };