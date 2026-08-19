const statisticsService = require("./statistics.service");
const { logger } = require("../../utils/logger");

function getPublicMessage(error, fallbackMessage) {
  return error?.statusCode && error.statusCode < 500
    ? error.message
    : fallbackMessage;
}

async function getSummary(req, res) {
  try {
    const result = await statisticsService.getStatisticsSummary({
      period: req.query?.period,
      siteId: req.query?.siteId,
      zoneId: req.query?.zoneId,
      startDate: req.query?.startDate,
      endDate: req.query?.endDate,
    });

    res.status(200).json({
      ok: true,
      period: result.period,
      range: result.range,
      bucketUnit: result.bucketUnit,
      summary: result.summary,
    });
  } catch (error) {
    logger.error("get statistics summary failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      period: req.query?.period,
      siteId: req.query?.siteId,
      zoneId: req.query?.zoneId,
      startDate: req.query?.startDate,
      endDate: req.query?.endDate,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "Failed to fetch statistics summary."),
    });
  }
}

async function getTrafficSeries(req, res) {
  try {
    const result = await statisticsService.getTrafficSeries({
      period: req.query?.period,
      siteId: req.query?.siteId,
      zoneId: req.query?.zoneId,
      startDate: req.query?.startDate,
      endDate: req.query?.endDate,
    });

    res.status(200).json({
      ok: true,
      period: result.period,
      range: result.range,
      bucketUnit: result.bucketUnit,
      series: result.series,
      summary: result.summary,
    });
  } catch (error) {
    logger.error("get traffic series failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      period: req.query?.period,
      siteId: req.query?.siteId,
      zoneId: req.query?.zoneId,
      startDate: req.query?.startDate,
      endDate: req.query?.endDate,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "Failed to fetch traffic series."),
    });
  }
}

module.exports = {
  getSummary,
  getTrafficSeries,
};
