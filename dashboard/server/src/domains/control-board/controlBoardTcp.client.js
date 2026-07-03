const net = require("net");

function sendTcpPacket({ host, port, packetBuffer, timeoutMs }) {
  // TCP 소켓은 한 번 연결해서 패킷을 쓰고, ACK 또는 timeout 결과를 service에 돌려준다.
  // 통합제어보드 응답 규격이 바뀌어도 이 함수 바깥의 API 구조는 유지하기 위한 얇은 client다.
  return new Promise((resolve, reject) => {
    // net.Socket은 Node.js 기본 TCP client다.
    // HTTP가 아니라 순수 TCP 바이트 스트림으로 10바이트 패킷을 전송한다.
    const socket = new net.Socket();

    // ACK가 여러 chunk로 올 가능성을 대비해 받은 Buffer 조각을 모아둔다.
    const chunks = [];

    // connect/data/timeout/error 이벤트가 거의 동시에 올 수 있어 한 번만 종료되도록 막는다.
    let settled = false;

    function finish(result) {
      // 성공/timeout처럼 API 응답으로 처리할 수 있는 결과는 resolve한다.
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    }

    function fail(error) {
      // 네트워크 연결 실패, 포트 오류 같은 실제 전송 실패는 reject해서 service에서 502로 바꾼다.
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    }

    // 통합제어보드가 ACK를 주지 않으면 무한 대기하지 않고 timeout 결과를 반환한다.
    socket.setTimeout(timeoutMs);

    socket.once("connect", () => {
      // 연결 성공 직후 이미 만들어진 10바이트 Buffer를 그대로 전송한다.
      socket.write(packetBuffer);
    });

    socket.on("data", (chunk) => {
      // 현재 구현은 첫 ACK chunk를 받으면 성공으로 본다.
      // ACK 패킷 길이가 명확히 확정되면 여기서 길이 기준을 추가할 수 있다.
      chunks.push(chunk);
      finish({
        ackReceived: true,
        ackBuffer: Buffer.concat(chunks),
      });
    });

    socket.once("timeout", () => {
      // TCP 연결 또는 응답 대기가 timeout되면 전송은 시도했지만 ACK 없음으로 기록한다.
      finish({
        ackReceived: false,
        timeout: true,
        ackBuffer: Buffer.concat(chunks),
      });
    });

    socket.once("error", fail);

    // 실제 랜선 연결 테스트에서는 host가 통합제어보드 IP, port가 이더넷 설정 port다.
    socket.connect(port, host);
  });
}

module.exports = {
  sendTcpPacket,
};
