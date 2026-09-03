const usersService = require("./users.service");
const { logger } = require("../../utils/logger");

function getPublicMessage(error, fallbackMessage) {
  return error?.statusCode && error.statusCode < 500
    ? error.message
    : fallbackMessage;
}

async function getMe(req, res) {
  try {
    const user = await usersService.getMyProfile({
      id: req.user.id,
    });

    res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    logger.warn("get current user profile failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "Failed to fetch current user profile."),
    });
  }
}

async function getUsers(req, res) {
  try {
    const result = await usersService.listUsers();

    res.status(200).json({
      ok: true,
      count: result.count,
      users: result.users,
    });
  } catch (error) {
    logger.error("get users list failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "Failed to fetch users list."),
    });
  }
}

async function getUserById(req, res) {
  try {
    const user = await usersService.getUserDetail({
      id: req.params.id,
    });

    res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    logger.error("get user detail failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      targetUserId: req.params.id,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "Failed to fetch user detail."),
    });
  }
}

async function createUser(req, res) {
  try {
    const user = await usersService.createUser({
      userId: req.body?.userId,
      name: req.body?.name,
      password: req.body?.password,
      role: req.body?.role,
      isActive: req.body?.isActive,
      requesterId: req.user?.id,
    });

    res.status(201).json({
      ok: true,
      user,
    });
  } catch (error) {
    logger.error("create user failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      payloadUserId: req.body?.userId,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "Failed to create user."),
    });
  }
}

async function updateUser(req, res) {
  try {
    const user = await usersService.updateUser({
      id: req.params.id,
      userId: req.body?.userId,
      name: req.body?.name,
      role: req.body?.role,
      isActive: req.body?.isActive,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });

    res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    logger.error("update user failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      targetUserId: req.params.id,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "Failed to update user."),
    });
  }
}

async function deactivateUser(req, res) {
  try {
    const user = await usersService.deactivateUser({
      id: req.params.id,
      requesterId: req.user.id,
    });

    res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    logger.error("deactivate user failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      targetUserId: req.params.id,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "Failed to deactivate user."),
    });
  }
}

async function verifyUserPassword(req, res) {
  try {
    const result = await usersService.verifyUserPassword({
      id: req.params.id,
      requesterId: req.user?.id,
      requesterRole: req.user?.role,
      currentPassword: req.body?.currentPassword,
    });

    res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    logger.error("verify user password failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      targetUserId: req.params.id,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "Failed to verify user password."),
    });
  }
}

async function updateUserPassword(req, res) {
  try {
    const user = await usersService.updateUserPassword({
      id: req.params.id,
      requesterId: req.user?.id,
      requesterRole: req.user?.role,
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword,
    });

    res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    logger.error("update user password failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      targetUserId: req.params.id,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "Failed to update user password."),
    });
  }
}

async function resetUserPassword(req, res) {
  try {
    const user = await usersService.resetUserPassword({
      id: req.params.id,
      requesterId: req.user?.id,
      newPassword: req.body?.newPassword,
    });

    res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    logger.error("reset user password failed", {
      requesterId: req.user?.id,
      requesterUserId: req.user?.userId,
      targetUserId: req.params.id,
      statusCode: error.statusCode,
      message: error.message,
    });

    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "사용자 비밀번호 초기화 중 오류가 발생했습니다."),
    });
  }
}

module.exports = {
  getMe,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  verifyUserPassword,
  updateUserPassword,
  resetUserPassword,
};
