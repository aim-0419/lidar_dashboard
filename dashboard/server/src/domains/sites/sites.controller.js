const { getSites, getSiteById } = require("./sites.service");
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

// 현장 상세 조회 요청을 받아 존/디바이스를 포함한 상세 정보를 반환한다.
async function getSiteByIdController(req, res) {
  const { id } = req.params;

  try {
    const site = await getSiteById(id);

    if (!site) {
      return res.status(404).json({
        ok: false,
        message: "해당 현장을 찾을 수 없습니다.",
      });
    }

    res.json({ ok: true, site });
  } catch (error) {
    logger.error("site detail query failed", { error, siteId: id });

    res.status(503).json({
      ok: false,
      message: "현장 상세 조회에 실패했습니다.",
    });
  }
}

module.exports = { getSitesController, getSiteByIdController };