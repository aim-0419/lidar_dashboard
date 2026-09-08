"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const { getUniqueConstraintTarget } = require("../src/utils/prisma-error");

test("Prisma 7 + adapter-pg 형태(meta.driverAdapterError)에서 컬럼명을 뽑는다", () => {
  const error = {
    code: "P2002",
    message: "Unique constraint failed on the fields: (`user_id`)",
    meta: {
      modelName: "User",
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          originalCode: "23505",
          kind: "UniqueConstraintViolation",
          constraint: { fields: ["user_id"] },
        },
      },
    },
  };

  assert.equal(getUniqueConstraintTarget(error), "user_id");
});

test("구버전 형태(meta.target 배열)와 호환된다", () => {
  const error = {
    code: "P2002",
    meta: { target: ["signup_requests_pending_email_key"] },
  };

  assert.equal(getUniqueConstraintTarget(error), "signup_requests_pending_email_key");
});

test("meta.target이 문자열이어도 처리한다", () => {
  const error = { code: "P2002", meta: { target: "users_phone_number_key" } };

  assert.equal(getUniqueConstraintTarget(error), "users_phone_number_key");
});

test("메타가 비어 있으면 메시지 문자열에서 필드명을 추출한다", () => {
  const error = {
    code: "P2002",
    message: "\nInvalid `prisma.user.create()` invocation\n\nUnique constraint failed on the fields: (`email`)",
    meta: { modelName: "User" },
  };

  assert.equal(getUniqueConstraintTarget(error), "email");
});

test("여러 컬럼 복합 제약도 콤마로 이어 붙인다", () => {
  const error = {
    code: "P2002",
    meta: {
      driverAdapterError: {
        cause: { constraint: { fields: ["controller_id", "protocol_device_id"] } },
      },
    },
  };

  assert.equal(getUniqueConstraintTarget(error), "controller_id,protocol_device_id");
});

test("아무 정보도 없으면 빈 문자열을 돌려준다", () => {
  assert.equal(getUniqueConstraintTarget({ code: "P2002", meta: {} }), "");
  assert.equal(getUniqueConstraintTarget({}), "");
});
