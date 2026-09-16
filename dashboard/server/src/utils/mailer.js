"use strict";

const { config } = require("../config");
const { logger } = require("./logger");

// Resend REST API 주소입니다. Resend를 직접 아는 코드는 이 파일 하나로 한정합니다.
// 나중에 다른 발송 서비스로 바꾸더라도 sendEmail의 입출력만 유지하면 됩니다.
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;
const PREVIEW_MAX_LENGTH = 300;

// 호출부(가입 인증코드 발송, 승인 알림 메일 등 후속 PR) 규칙:
// - 이 함수는 예외를 던지지 않고 { delivered } 로만 결과를 알린다. 반드시 delivered를 확인한다.
// - "코드 발송"류 API: delivered=false면 "메일 보냄" 상태를 DB에 남기지 말고 사용자에게 재시도를 안내한다.
// - "승인 알림"류 동작: 메일 실패와 무관하게 본 동작(승인 등)은 성공해야 한다. 실패는 로그만 남기고 넘어간다.
// - 재시도는 이 함수가 하지 않는다. 필요하면 호출부가 쿨다운을 두고 재요청 경로를 제공한다.
// - 개발 환경(키 없음)에서도 내용을 확인할 수 있도록 호출부는 text(평문 본문)를 함께 넘긴다.

// 로그·에러 메시지에 API 키 원문이 남지 않도록 수신자만 요약합니다.
function describeRecipients(to) {
  return Array.isArray(to) ? to.join(", ") : String(to || "");
}

// 키가 없는 개발 환경에서 서버 로그만으로 메일 내용을 확인할 수 있도록 짧은 미리보기를 만듭니다.
function buildPreview(text, html) {
  const source = text || String(html || "").replace(/<[^>]+>/g, " ");
  return source.replace(/\s+/g, " ").trim().slice(0, PREVIEW_MAX_LENGTH);
}

/**
 * 메일 한 통을 발송합니다. 이 함수는 어떤 경우에도 예외를 throw 하지 않고,
 * 결과 객체로만 성공/실패/건너뜀을 알립니다. 호출부가 실패를 어떻게 처리할지 결정합니다.
 *
 * @param {object} params
 * @param {string|string[]} params.to  수신자 이메일
 * @param {string} params.subject      제목
 * @param {string} params.html         본문 HTML
 * @param {string} [params.text]       본문 평문 대체 (개발 환경 확인용으로 되도록 함께 넘길 것)
 * @returns {Promise<{delivered: boolean, id?: string, skipped?: boolean, error?: string}>}
 */
async function sendEmail({ to, subject, html, text } = {}) {
  const recipients = describeRecipients(to);

  if (!recipients || !subject || !html) {
    logger.warn("email send skipped: missing required fields", {
      hasTo: Boolean(recipients),
      hasSubject: Boolean(subject),
      hasHtml: Boolean(html),
    });
    return { delivered: false, error: "to, subject, html은 필수입니다." };
  }

  // API 키가 없으면 개발 환경으로 보고 실제 발송 대신 로그만 남깁니다.
  // 본문 미리보기까지 남겨 개발자가 인증 코드 등을 서버 로그에서 확인할 수 있게 합니다.
  if (!config.mail.enabled) {
    logger.info("email send skipped: RESEND_API_KEY not set", {
      to: recipients,
      subject,
      preview: buildPreview(text, html),
    });
    return { delivered: false, skipped: true };
  }

  const payload = { from: config.mail.from, to, subject, html };
  if (text) {
    payload.text = text;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.mail.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const bodyText = await response.text();

    if (!response.ok) {
      logger.error("email send failed", {
        to: recipients,
        subject,
        status: response.status,
        response: bodyText.slice(0, 500),
      });
      return { delivered: false, error: `Resend 응답 ${response.status}` };
    }

    let id;
    try {
      id = JSON.parse(bodyText).id;
    } catch {
      id = undefined;
    }

    logger.info("email sent", { to: recipients, subject, id });
    return { delivered: true, id };
  } catch (error) {
    const reason = error.name === "AbortError" ? "요청 시간 초과" : error.message;
    logger.error("email send failed", { to: recipients, subject, message: reason });
    return { delivered: false, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendEmail };
