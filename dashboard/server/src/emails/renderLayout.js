"use strict";

// 발송하는 모든 메일이 공유하는 기본 HTML 껍데기입니다.
// 인증 코드 안내, 승인 완료 안내 같은 구체적인 본문은 이 레이아웃 위에 얹어 사용합니다.
// 메일 클라이언트 호환을 위해 스타일은 인라인으로만 작성합니다.

const BRAND_NAME = "라이다 역주행 관제";

// 사용자 입력값을 HTML 본문에 넣기 전에 특수문자를 escape 합니다.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 공통 메일 레이아웃을 렌더링합니다.
 *
 * @param {object} params
 * @param {string} params.heading      메일 상단에 크게 보일 제목
 * @param {string} params.contentHtml  본문 HTML (호출부에서 필요한 escape 처리를 마친 상태)
 * @param {string} [params.footerNote] 본문 아래 회색으로 보일 부가 안내 문구 (평문)
 * @returns {string} 완성된 HTML 문서 문자열
 */
function renderLayout({ heading, contentHtml, footerNote } = {}) {
  const safeHeading = escapeHtml(heading || BRAND_NAME);
  const body = contentHtml || "";
  const footer = footerNote
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#8a8f98;">${escapeHtml(footerNote)}</p>`
    : "";

  return [
    "<!doctype html>",
    '<html lang="ko">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${safeHeading}</title>`,
    "</head>",
    '<body style="margin:0;padding:0;background:#f4f5f7;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;">',
    "<tr><td align=\"center\">",
    '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">',
    `<tr><td style="padding:20px 28px;border-bottom:1px solid #eef0f2;font-size:13px;font-weight:700;color:#4b5563;">${escapeHtml(BRAND_NAME)}</td></tr>`,
    "<tr><td style=\"padding:28px;\">",
    `<h1 style="margin:0 0 16px;font-size:18px;line-height:1.4;color:#1f2937;">${safeHeading}</h1>`,
    `<div style="font-size:14px;line-height:1.7;color:#374151;">${body}</div>`,
    footer,
    "</td></tr>",
    "</table>",
    '<p style="margin:16px 0 0;font-size:11px;color:#b0b4bb;">본 메일은 발신 전용입니다.</p>',
    "</td></tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
}

module.exports = { renderLayout, escapeHtml, BRAND_NAME };
