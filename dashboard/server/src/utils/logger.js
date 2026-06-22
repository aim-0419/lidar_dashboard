const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel = String(process.env.LOG_LEVEL || "info").toLowerCase();
const minimumPriority = LEVEL_PRIORITY[currentLevel] || LEVEL_PRIORITY.info;

function normalizeMeta(meta) {
  if (!meta || typeof meta !== "object") return {};

  // meta는 logger 호출 시 함께 넘긴 추가 정보다.
  // 그대로 출력하기 어려운 값은 logMeta에 로그용 형태로 정리해서 담는다.
  const logMeta = {};

  for (const [key, value] of Object.entries(meta)) {
    // Error 객체는 JSON 변환 시 내용이 빠질 수 있어 필요한 값만 직접 꺼낸다.
    if (value instanceof Error) {
      logMeta[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
      continue;
    }

    logMeta[key] = value;
  }

  return logMeta;
}

function write(level, message, meta) {
  // LOG_LEVEL보다 낮은 중요도의 로그는 출력하지 않는다.
  if (LEVEL_PRIORITY[level] < minimumPriority) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...normalizeMeta(meta),
  };

  const output = JSON.stringify(entry);
  if (level === "error") {
    console.error(output);
    return;
  }

  if (level === "warn") {
    console.warn(output);
    return;
  }

  console.log(output);
}

// 서버 운영 로그를 한 곳에서 관리한다. 화면 표시용 이벤트 로그는 pushLog를 사용한다.
const logger = {
  debug: (message, meta) => write("debug", message, meta),
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
};

module.exports = { logger };
