const fs = require("fs");
const path = require("path");
const { SerialPort } = require("serialport");

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.json"), "utf-8")
);

const PORT = config.serverPort || 5000;
const DASHBOARD_BASE = process.env.DASHBOARD_BASE || `http://${config.dashboardIP}:${PORT}`;

const eventsPath = path.join(__dirname, "demoEvents.json");

const events = JSON.parse(fs.readFileSync(eventsPath, "utf-8"));
const timers = [];

// ------------------------------
// Serial Port
// ------------------------------
const port = new SerialPort({
  path: config.serialPort,
  baudRate: config.baudRate || 9600,
  autoOpen: false,
});

// ------------------------------
// RS485 Protocol Packets
// ------------------------------

// 시나리오1 1차경고 (LED + 스피커)
const cmdScenario1 = Buffer.from([
  0x02, 0xA1, 0x10, 0x01, 0x01, 0x02, 0x00, 0xD2, 0x03, 0x0D
]);

// 시나리오2 : 2차 경고 (전체 설비)
const cmdScenario2 = Buffer.from([
  0x02, 0xA1, 0x10, 0x02, 0x01, 0x01, 0x00, 0x10, 0x03, 0x0D
]);

// 시나리오3 : 2차 경고 종료 및 차단기 복귀
const cmdScenario3 = Buffer.from([
  0x02, 0xA1, 0x10, 0x02, 0x02, 0x12, 0x00, 0x6F, 0x03, 0x0D
]);

// 시나리오4 : 전체 리셋
const cmdScenario4 = Buffer.from([
  0x02, 0xA1, 0x10, 0x00, 0x00, 0x01, 0x00, 0x2E, 0x03, 0x0D
]);

// ------------------------------
// Open Port
// ------------------------------
port.open((err) => {
  if (err) {
    console.error("포트 열기 실패:", err.message);
    return;
  }

  console.log("COM opened");
});

port.on("data", (data) => {
  console.log("수신:", data.toString("hex").match(/.{1,2}/g).join(" "));
});

port.on("error", (err) => {
  console.error("시리얼 에러:", err.message);
});

// ------------------------------
// Delay
// ------------------------------
const DELAY_MS = 1000;

// ------------------------------
// Dashboard Event Send
// ------------------------------
async function sendEvent(evt) {
  const body = {
    type: "wrong-way",
    timestamp: new Date().toISOString(),
    zone_id: evt.zone_id,
    track_id: evt.track_id,
    stage: evt.stage,
    confidence: evt.confidence,
    message: evt.message,
    device_id: evt.device_id,
    serial_no: evt.serial_no,
    video_ts_ms: evt.video_ts_ms,
  };

  try {
    const res = await fetch(`${DASHBOARD_BASE}/api/wrongway`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    console.log(`[replay] sent ${evt.track_id} -> ${res.status}`);
  } catch (err) {
    console.log("[replay] send failed:", err);
  }
}

// ------------------------------
// Serial Send
// ------------------------------
function sendSerialCommand(cmd, label) {
    if(!port.isOpen) {
        console.error("[serial] port not open");
        return;
    }

   port.write(cmd, (err) => {
    if (err) {
      console.error(`[serial] ${label} 송신 실패:`, err.message);
      return;
    }

    const hex = cmd.toString("hex").match(/.{1,2}/g).join(" ");
    console.log(`[serial] ${label} 송신 완료: ${hex}`);
  });
}

// ------------------------------
// Event Trigger
// ------------------------------
function triggerEvent(evt, idx) {
  // 1) 팝업 이벤트 전송
  sendEvent(evt);
  
  // 2) 보드 명령 전송
  if (idx < 2) {
    // 1,2번째 이벤트 -> 시나리오1
    sendSerialCommand(cmdScenario1, "시나리오1");

    //3초 뒤 리셋
    const resetTimer = setTimeout(() => {
        sendSerialCommand(cmdScenario4, "시나리오4(리셋)");
    }, 3000);
    timers.push(resetTimer);

  } else {
    // 마지막 이벤트 -> 시나리오2
    sendSerialCommand(cmdScenario2, "시나리오2");

    // 3초 뒤 차단기 복귀
    const recoveryTimer = setTimeout(() => {
        sendSerialCommand(cmdScenario3, "시나리오3");
    }, 3000);
    timers.push(recoveryTimer);

    // 1초 뒤 리셋
    const resetTimer = setTimeout(() => {
        sendSerialCommand(cmdScenario4, "시나리오4(리셋)");
    }, 4000);
    timers.push(resetTimer);
  }
}

// ------------------------------
// Start Replay
// ------------------------------
function startReplay() {
  if (!Array.isArray(events) || events.length === 0) {
    console.log("[replay] no events");
    process.exit(0);
  }

  for (const [idx, evt] of events.entries()) {
    const timer = setTimeout(() => {
      triggerEvent(evt, idx);
    }, evt.video_ts_ms + DELAY_MS);

    timers.push(timer);
  }

  const lastTs = Math.max(...events.map((e) => e.video_ts_ms || 0));
  const exitTimer = setTimeout(() => {
    console.log("[replay] finished");
    if (port.isOpen) {
      port.close();
    }
    process.exit(0);
  }, lastTs + DELAY_MS + 6000);

  timers.push(exitTimer);
}

// ------------------------------
// Event Trigger
// ------------------------------
process.on("SIGTERM", () => {
  timers.forEach(clearTimeout);
  if (port.isOpen) port.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  timers.forEach(clearTimeout);
  if (port.isOpen) port.close();
  process.exit(0);
});

startReplay();