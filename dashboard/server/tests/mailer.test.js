"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

// mailer.js를 격리해서 불러오면서 config, logger, fetch를 테스트용으로 주입합니다.
function loadMailer({ mail, fetchImpl } = {}) {
  const filename = path.resolve(__dirname, "../src/utils/mailer.js");
  const loaded = { exports: {} };
  const logs = [];

  const fakeLogger = {
    debug: (message, meta) => logs.push({ level: "debug", message, meta }),
    info: (message, meta) => logs.push({ level: "info", message, meta }),
    warn: (message, meta) => logs.push({ level: "warn", message, meta }),
    error: (message, meta) => logs.push({ level: "error", message, meta }),
  };

  const fakeConfig = {
    config: {
      mail: {
        apiKey: mail?.apiKey ?? "",
        from: mail?.from ?? "테스트 발신 <onboarding@resend.dev>",
        appBaseUrl: mail?.appBaseUrl ?? "http://localhost:5173",
        enabled: Boolean(mail?.apiKey),
      },
    },
  };

  vm.runInNewContext(
    fs.readFileSync(filename, "utf8"),
    {
      module: loaded,
      exports: loaded.exports,
      require(name) {
        if (name === "../config") return fakeConfig;
        if (name === "./logger") return { logger: fakeLogger };
        throw new Error(`Unexpected dependency: ${name}`);
      },
      fetch: fetchImpl || (async () => {
        throw new Error("fetch should not be called in this test");
      }),
      AbortController,
      setTimeout,
      clearTimeout,
    },
    { filename },
  );

  return { sendEmail: loaded.exports.sendEmail, logs };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

test("필수 필드가 빠지면 발송하지 않고 error를 돌려준다", async () => {
  let called = false;
  const { sendEmail } = loadMailer({
    mail: { apiKey: "re_test" },
    fetchImpl: async () => {
      called = true;
      return jsonResponse(200, { id: "x" });
    },
  });

  const result = await sendEmail({ to: "", subject: "제목", html: "<p>본문</p>" });

  assert.equal(result.delivered, false);
  assert.ok(result.error);
  assert.equal(called, false);
});

test("API 키가 없으면 실제 발송 대신 skipped로 처리하고 본문 미리보기를 로그에 남긴다", async () => {
  const { sendEmail, logs } = loadMailer({ mail: { apiKey: "" } });

  const result = await sendEmail({
    to: "user@example.com",
    subject: "인증 코드",
    html: "<p>인증 코드는 <b>123456</b> 입니다.</p>",
    text: "인증 코드는 123456 입니다.",
  });

  assert.equal(result.delivered, false);
  assert.equal(result.skipped, true);

  const skipLog = logs.find((entry) => entry.level === "info" && entry.message.includes("skipped"));
  assert.ok(skipLog);
  assert.equal(skipLog.meta.preview, "인증 코드는 123456 입니다.");
});

test("text가 없으면 html에서 태그를 걷어낸 미리보기를 만든다", async () => {
  const { sendEmail, logs } = loadMailer({ mail: { apiKey: "" } });

  await sendEmail({
    to: "user@example.com",
    subject: "제목",
    html: "<p>인증 코드는 <b>654321</b> 입니다.</p>",
  });

  const skipLog = logs.find((entry) => entry.level === "info" && entry.message.includes("skipped"));
  assert.match(skipLog.meta.preview, /654321/);
  assert.ok(!skipLog.meta.preview.includes("<"));
});

test("정상 발송하면 delivered:true와 메일 id를 돌려준다", async () => {
  let sentUrl;
  let sentInit;
  const { sendEmail } = loadMailer({
    mail: { apiKey: "re_test", from: "관제 <onboarding@resend.dev>" },
    fetchImpl: async (url, init) => {
      sentUrl = url;
      sentInit = init;
      return jsonResponse(200, { id: "email_abc123" });
    },
  });

  const result = await sendEmail({
    to: "user@example.com",
    subject: "인증 코드",
    html: "<p>123456</p>",
  });

  assert.equal(result.delivered, true);
  assert.equal(result.id, "email_abc123");
  assert.equal(sentUrl, "https://api.resend.com/emails");
  assert.equal(sentInit.method, "POST");
  assert.equal(sentInit.headers.Authorization, "Bearer re_test");

  const payload = JSON.parse(sentInit.body);
  assert.equal(payload.from, "관제 <onboarding@resend.dev>");
  assert.equal(payload.to, "user@example.com");
  assert.equal(payload.subject, "인증 코드");
  assert.equal(payload.html, "<p>123456</p>");
  assert.equal(Object.hasOwn(payload, "text"), false);
});

test("text를 넘기면 payload에 함께 담는다", async () => {
  let sentInit;
  const { sendEmail } = loadMailer({
    mail: { apiKey: "re_test" },
    fetchImpl: async (url, init) => {
      sentInit = init;
      return jsonResponse(200, { id: "email_1" });
    },
  });

  await sendEmail({
    to: "user@example.com",
    subject: "제목",
    html: "<p>본문</p>",
    text: "본문",
  });

  assert.equal(JSON.parse(sentInit.body).text, "본문");
});

test("Resend가 오류 응답을 주면 throw 없이 error를 돌려준다", async () => {
  const { sendEmail, logs } = loadMailer({
    mail: { apiKey: "re_test" },
    fetchImpl: async () => jsonResponse(422, { message: "invalid to" }),
  });

  const result = await sendEmail({
    to: "user@example.com",
    subject: "제목",
    html: "<p>본문</p>",
  });

  assert.equal(result.delivered, false);
  assert.match(result.error, /422/);
  assert.ok(logs.some((entry) => entry.level === "error"));
});

test("네트워크 예외가 나도 throw 없이 error를 돌려준다", async () => {
  const { sendEmail, logs } = loadMailer({
    mail: { apiKey: "re_test" },
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });

  const result = await sendEmail({
    to: "user@example.com",
    subject: "제목",
    html: "<p>본문</p>",
  });

  assert.equal(result.delivered, false);
  assert.equal(result.error, "network down");
  assert.ok(logs.some((entry) => entry.level === "error"));
});
