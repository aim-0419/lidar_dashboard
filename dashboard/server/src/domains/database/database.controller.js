const { getDatabaseHealth } = require("./database.service");
const { logger } = require("../../utils/logger");

async function getDatabaseHealthController(req, res) {
  try {
    const health = await getDatabaseHealth();
    res.json(health);
  } catch (error) {
    logger.error("database health check failed", { error });

    res.status(503).json({
      ok: false,
      checkedAt: new Date().toISOString(),
      message: "DB 연결 또는 기본 테이블 조회에 실패했습니다.",
    });
  }
}

module.exports = { getDatabaseHealthController };
