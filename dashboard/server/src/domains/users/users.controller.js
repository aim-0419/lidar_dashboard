const usersService = require("./users.service");

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
    res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "내 정보 조회 중 오류가 발생했습니다.",
    });
  }
}

module.exports = { getMe };
