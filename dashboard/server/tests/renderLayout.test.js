"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const { renderLayout, escapeHtml, BRAND_NAME } = require("../src/emails/renderLayout");

test("escapeHtml은 HTML 특수문자를 엔티티로 바꾼다", () => {
  assert.equal(escapeHtml(`<b>"a"&'b'`), "&lt;b&gt;&quot;a&quot;&amp;&#39;b&#39;");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(123456), "123456");
});

test("renderLayout은 heading과 본문 HTML을 포함한 완성 문서를 만든다", () => {
  const html = renderLayout({
    heading: "이메일 인증 코드",
    contentHtml: "<p>코드는 <strong>123456</strong> 입니다.</p>",
    footerNote: "본인이 요청하지 않았다면 무시하세요.",
  });

  assert.match(html, /^<!doctype html>/);
  assert.ok(html.includes("이메일 인증 코드"));
  assert.ok(html.includes("<strong>123456</strong>"));
  assert.ok(html.includes("본인이 요청하지 않았다면 무시하세요."));
  assert.ok(html.includes(BRAND_NAME));
});

test("footerNote 없이도 렌더링된다", () => {
  const html = renderLayout({ heading: "제목", contentHtml: "<p>본문</p>" });

  assert.ok(html.includes("<p>본문</p>"));
  assert.ok(!html.includes("undefined"));
});
