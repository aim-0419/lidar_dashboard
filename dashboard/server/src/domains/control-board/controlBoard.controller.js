const service = require("./controlBoard.service");

function getPublicMessage(error, fallbackMessage) {
  return error?.statusCode && error.statusCode < 500
    ? error.message
    : fallbackMessage;
}

async function sendCommand(req, res) {
  try {
    // controller는 HTTP 요청/응답만 담당합니다.
    // 실제 패킷 생성, CRC 계산, TCP 전송은 service에서 처리합니다.
    const command = await service.sendControlBoardCommand(req.body || {});
    res.json(command);
  } catch (error) {
    // service에서 만든 command 진단 정보가 있으면 실패 응답에도 함께 내려줍니다.
    // 현장 테스트에서는 실패한 패킷과 사유를 바로 확인해야 하기 때문입니다.
    res.status(error.statusCode || 500).json({
      ok: false,
      message: getPublicMessage(error, "제어보드 명령 처리 중 오류가 발생했습니다."),
      command: error.command || null,
    });
  }
}

function getCommand(req, res) {
  // 메모리에 쌓인 최근 명령 중 하나를 commandId로 찾습니다.
  // DB 저장 단계가 없으므로 서버 재시작 시 이력은 사라집니다.
  const command = service.getCommand(req.params.id);
  if (!command) {
    res.status(404).json({ ok: false, message: "제어 명령을 찾을 수 없습니다." });
    return;
  }

  res.json({ ok: true, item: command });
}

function getCommands(req, res) {
  // 최근 명령 목록은 현장 테스트 확인용이므로 기본 20건만 반환합니다.
  const limit = Number(req.query.limit) || 20;
  res.json({ ok: true, items: service.getCommandHistory(limit) });
}

module.exports = {
  getCommand,
  getCommands,
  sendCommand,
};
