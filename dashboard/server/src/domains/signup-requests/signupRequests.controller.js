const signupRequestsService = require("./signupRequests.service");
const { logger } = require("../../utils/logger");

function getPublicMessage(error, fallbackMessage) {
  return error?.statusCode && error.statusCode < 500 ? error.message : fallbackMessage;
}

async function createSignupRequest(req, res) {
  try {
    const request = await signupRequestsService.createSignupRequest({
      userId: req.body?.userId,
      name: req.body?.name,
      password: req.body?.password,
      email: req.body?.email,
      phoneNumber: req.body?.phoneNumber,
    });

    res.status(201).json({
      ok: true,
      request,
    });
  } catch (error) {
    logger.error("create signup request failed", {
      payloadUserId: req.body?.userId,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "가입 신청 처리 중 오류가 발생했습니다."),
    });
  }
}

async function checkSignupRequestUserId(req, res) {
  try {
    const result = await signupRequestsService.checkUserIdAvailability(req.query?.userId);

    res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    logger.warn("signup request user id availability check failed", {
      userId: req.query?.userId,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "사용 가능한 ID 확인 중 오류가 발생했습니다."),
    });
  }
}

async function getSignupRequests(req, res) {
  try {
    const result = await signupRequestsService.listSignupRequests({
      status: req.query?.status,
      page: req.query?.page,
      limit: req.query?.limit,
    });

    res.status(200).json({
      ok: true,
      count: result.count,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      requests: result.requests,
    });
  } catch (error) {
    logger.error("get signup requests failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "가입 신청 목록 조회 중 오류가 발생했습니다."),
    });
  }
}

async function approveSignupRequest(req, res) {
  try {
    const request = await signupRequestsService.approveSignupRequest({
      id: req.params.id,
      reviewerId: req.user?.id,
    });

    res.status(200).json({
      ok: true,
      request,
    });
  } catch (error) {
    logger.error("approve signup request failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      signupRequestId: req.params.id,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "가입 신청 승인 처리 중 오류가 발생했습니다."),
    });
  }
}

async function rejectSignupRequest(req, res) {
  try {
    const request = await signupRequestsService.rejectSignupRequest({
      id: req.params.id,
      reviewerId: req.user?.id,
      rejectReason: req.body?.rejectReason,
    });

    res.status(200).json({
      ok: true,
      request,
    });
  } catch (error) {
    logger.error("reject signup request failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      signupRequestId: req.params.id,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "가입 신청 반려 처리 중 오류가 발생했습니다."),
    });
  }
}

module.exports = {
  createSignupRequest,
  checkSignupRequestUserId,
  getSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
};
