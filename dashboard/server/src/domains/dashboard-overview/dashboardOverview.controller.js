const { getDashboardOverview } = require("./dashboardOverview.service");
const { logger } = require("../../utils/logger");

// 메인 대시보드 현황(KPI, 현재 감지 객체, 라이다 수신 상태) 조회 요청을 처리한다.
async function getDashboardOverviewController(req, res) {
  try {
    const overview = await getDashboardOverview();
    res.json({ success: true, data: overview, message: "OK" });
  } catch (error) {
    logger.error("dashboard overview query failed", { message: error.message });

    res.status(503).json({
      success: false,
      error: {
        status: 503,
        code: "DASHBOARD_OVERVIEW_QUERY_FAILED",
        message: "대시보드 현황 조회에 실패했습니다.",
        details: [],
      },
    });
  }
}

module.exports = { getDashboardOverviewController };
