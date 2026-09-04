const express = require("express");
const {
  getMe,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  verifyUserPassword,
  updateUserPassword,
  resetUserPassword,
} = require("./users.controller");
const { authenticateToken, requireRole } = require("../../middlewares/auth.middleware");
const { passwordRateLimit } = require("../../middlewares/password-rate-limit.middleware");

const router = express.Router();

router.get("/users/me", authenticateToken, getMe);
router.get("/users", authenticateToken, requireRole("SUPER_ADMIN"), getUsers);
router.get("/users/:id", authenticateToken, requireRole("SUPER_ADMIN"), getUserById);
router.post("/users", authenticateToken, requireRole("SUPER_ADMIN"), createUser);
router.patch("/users/:id", authenticateToken, updateUser);
router.delete("/users/:id", authenticateToken, requireRole("SUPER_ADMIN"), deactivateUser);
router.post("/users/:id/password/verify", authenticateToken, passwordRateLimit, verifyUserPassword);
router.patch("/users/:id/password", authenticateToken, passwordRateLimit, updateUserPassword);
router.patch(
  "/users/:id/password/reset",
  authenticateToken,
  requireRole("SUPER_ADMIN"),
  passwordRateLimit,
  resetUserPassword,
);

module.exports = router;
