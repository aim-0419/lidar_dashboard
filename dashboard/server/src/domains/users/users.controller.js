const usersService = require("./users.service");
const { logger } = require("../../utils/logger");

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
      message: error.message || "Failed to fetch current user profile.",
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
      message: error.message || "Failed to fetch users list.",
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
      message: error.message || "Failed to fetch user detail.",
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
      message: error.message || "Failed to create user.",
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
      message: error.message || "Failed to update user.",
    });
  }
}

async function deactivateUser(req, res) {
  try {
    const user = await usersService.deactivateUser({
      id: req.params.id,
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
      message: error.message || "Failed to deactivate user.",
    });
  }
}

async function updateUserPassword(req, res) {
  try {
    const user = await usersService.updateUserPassword({
      id: req.params.id,
      password: req.body?.password,
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
      message: error.message || "Failed to update user password.",
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
  updateUserPassword,
};
