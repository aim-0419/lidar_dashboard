const express = require("express");
const {
  getMe,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  updateUserPassword,
} = require("./users.controller");
const { authenticateToken, requireRole } = require("../../middlewares/auth.middleware");

const router = express.Router();

router.get("/users/me", authenticateToken, getMe);
router.get("/users", authenticateToken, requireRole("SUPER_ADMIN"), getUsers);
router.get("/users/:id", authenticateToken, requireRole("SUPER_ADMIN"), getUserById);
router.post("/users", authenticateToken, requireRole("SUPER_ADMIN"), createUser);
router.patch("/users/:id", authenticateToken, requireRole("SUPER_ADMIN"), updateUser);
router.delete("/users/:id", authenticateToken, requireRole("SUPER_ADMIN"), deactivateUser);
router.patch("/users/:id/password", authenticateToken, requireRole("SUPER_ADMIN"), updateUserPassword);

module.exports = router;
