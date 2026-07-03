const { config } = require("../../config");
const { logger } = require("../../utils/logger");
const { buildControlBoardPacket, parseControlBoardPacket } = require("../external-ingest/protocol/controlBoardProtocol");
const { sendTcpPacket } = require("./controlBoardTcp.client");

// DB 테이블이 확정되기 전까지 최근 명령 결과만 메모리에 보관한다.
// 현장 테스트에서 "방금 보낸 명령이 어떤 패킷이었는지" 확인하는 용도다.
const MAX_COMMAND_HISTORY = 50;
let commandHistory = [];

function createCommandId() {
  // DB 저장 전 단계라 UUID 대신 로그 추적이 가능한 간단한 commandId를 만든다.
  return `cmd_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function toHexString(buffer) {
  // 장비 패킷/ACK는 사람이 읽기 어려운 Buffer라 HEX 문자열로 바꿔 응답과 로그에 남긴다.
  return Array.from(buffer || [])
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
}

function rememberCommand(command) {
  // 최신 명령을 맨 앞에 보관해서 GET 목록 조회 시 최근 순서로 볼 수 있게 한다.
  commandHistory.unshift(command);
  if (commandHistory.length > MAX_COMMAND_HISTORY) {
    commandHistory = commandHistory.slice(0, MAX_COMMAND_HISTORY);
  }
}

function getCommand(commandId) {
  // commandId로 최근 명령 하나를 찾는다. 서버 재시작 시 메모리 이력은 초기화된다.
  return commandHistory.find((command) => command.commandId === commandId) || null;
}

function getCommandHistory(limit = 20) {
  // Swagger/현장 테스트에서 너무 많은 이력을 내려주지 않도록 limit만큼 잘라 반환한다.
  return commandHistory.slice(0, limit);
}

async function sendControlBoardCommand(payload = {}) {
  // HTTP 요청 하나가 들어오면 이 함수가 명령 검증부터 TCP 전송 결과 정리까지 모두 담당한다.
  // 흐름: 요청값 검증 -> 10바이트 패킷 생성 -> dryRun 또는 TCP 전송 -> 결과 이력 저장.
  const commandId = createCommandId();
  const requestedAt = new Date().toISOString();

  // host/port는 기본적으로 .env 값을 쓰고, 현장 임시 테스트 때는 요청 body 값으로 덮어쓸 수 있다.
  const host = payload.host || config.controlBoardHost;
  const port = Number(payload.port || config.controlBoardPort);
  const timeoutMs = Number(payload.timeoutMs || config.controlBoardTimeoutMs || 3000);

  // dryRun은 실제 TCP 연결 없이 패킷 생성과 CRC 검증만 보는 모드다.
  // 장비 연결 전 Swagger/curl 테스트에서 가장 먼저 사용한다.
  const dryRun = payload.dryRun === true;

  if (!payload.commandType) {
    // 어떤 명령을 보낼지 없으면 패킷의 MODE/STATUS/SELECT를 만들 수 없다.
    const error = new Error("commandType은 필수입니다.");
    error.statusCode = 400;
    throw error;
  }

  if (!dryRun && (!host || !port)) {
    // 실제 전송 모드에서는 통합제어보드 IP/port가 반드시 필요하다.
    // dryRun에서는 장비가 없어도 패킷만 확인할 수 있어 이 검사를 건너뛴다.
    const error = new Error("통합제어보드 host/port 설정이 필요합니다.");
    error.statusCode = 400;
    throw error;
  }

  // commandType을 PDF 프로토콜의 MODE/STATUS/SELECT 조합으로 바꿔 10바이트 패킷을 만든다.
  // options 값은 현장 프로토콜 조정이 필요할 때 특정 바이트를 임시로 덮어쓰기 위한 통로다.
  const packet = buildControlBoardPacket(payload.commandType, {
    deviceId: payload.deviceId,
    mode: payload.mode,
    status: payload.status,
    select: payload.select,
    reserved: payload.reserved,
  });

  // dryRun/성공/실패 응답이 공통으로 공유하는 기본 진단 객체다.
  // packet.parsed에는 우리가 만든 패킷을 다시 파싱한 결과가 들어가므로 CRC가 맞는지 바로 확인할 수 있다.
  const baseCommand = {
    ok: true,
    commandId,
    commandType: packet.command,
    status: dryRun ? "dry-run" : "pending",
    host: host || null,
    port: port || null,
    requestedAt,
    sentAt: null,
    ackAt: null,
    ackReceived: false,
    timeout: false,
    reason: payload.reason || null,
    zoneId: payload.zoneId || payload.zone_id || null,
    packet: {
      hex: packet.hex,
      hexString: packet.hexString,
      parsed: packet.parsed,
    },
    ack: null,
  };

  if (dryRun) {
    // dryRun은 TCP client를 호출하지 않는다.
    // 패킷 생성 결과만 저장/반환해서 실제 장비 연결 전에도 명령 프레임을 검토할 수 있게 한다.
    rememberCommand(baseCommand);
    logger.info("control board command dry-run", {
      commandId,
      commandType: packet.command,
      packet: packet.hexString,
    });
    return baseCommand;
  }

  try {
    // 여기부터 실제 장비 연결 구간이다.
    // TCP client는 Buffer를 그대로 보내고 ACK 또는 timeout 결과를 돌려준다.
    const sentAt = new Date().toISOString();
    const result = await sendTcpPacket({
      host,
      port,
      packetBuffer: packet.buffer,
      timeoutMs,
    });

    // ACK도 장비 패킷이면 같은 parser로 해석한다.
    // 아직 ACK 규격이 확정되지 않았으므로, 일단 원본 HEX와 파싱 시도 결과를 모두 남긴다.
    const ackHexString = toHexString(result.ackBuffer);
    const ackPacket = result.ackBuffer?.length ? parseControlBoardPacket(Array.from(result.ackBuffer)) : null;

    // ACK를 받으면 ack-received, timeout이면 sent-timeout으로 구분한다.
    // timeout은 TCP 전송 실패와 다르다. 연결/전송은 되었지만 응답을 못 받은 상태로 본다.
    const command = {
      ...baseCommand,
      status: result.ackReceived ? "ack-received" : "sent-timeout",
      sentAt,
      ackAt: result.ackReceived ? new Date().toISOString() : null,
      ackReceived: result.ackReceived,
      timeout: result.timeout === true,
      ack: result.ackBuffer?.length
        ? {
            hexString: ackHexString,
            parsed: ackPacket,
          }
        : null,
    };

    // 성공/timeout 모두 현장 추적을 위해 이력에 남긴다.
    rememberCommand(command);
    logger.info("control board tcp command sent", {
      commandId,
      commandType: packet.command,
      host,
      port,
      status: command.status,
    });
    return command;
  } catch (error) {
    // 이 구간은 TCP 연결 자체 실패, 잘못된 host/port, 네트워크 오류처럼 명령 전송이 실패한 경우다.
    // 실패하더라도 어떤 패킷을 보내려 했는지 command에 남겨서 디버깅할 수 있게 한다.
    const command = {
      ...baseCommand,
      ok: false,
      status: "send-failed",
      sentAt: new Date().toISOString(),
      error: error.message,
    };

    // 실패 이력도 목록 API에서 볼 수 있게 저장한다.
    rememberCommand(command);
    logger.error("control board tcp command failed", {
      commandId,
      commandType: packet.command,
      host,
      port,
      error,
    });

    // controller는 HTTP 상태만 알면 되므로, 상세 command는 error 객체에 붙여서 같이 내려준다.
    const wrapped = new Error("통합제어보드 TCP 명령 전송에 실패했습니다.");
    wrapped.statusCode = 502;
    wrapped.command = command;
    throw wrapped;
  }
}

module.exports = {
  getCommand,
  getCommandHistory,
  sendControlBoardCommand,
};
