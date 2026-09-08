"use strict";

/**
 * Prisma P2002(고유 제약 위반) 에러에서 충돌한 컬럼/제약 이름을 뽑아
 * 콤마로 이어 붙인 문자열로 돌려준다. 아무 데서도 못 찾으면 빈 문자열.
 *
 * Prisma 7 + @prisma/adapter-pg(드라이버 어댑터) 조합에서는 예전처럼
 * `error.meta.target`이 채워지지 않고
 * `error.meta.driverAdapterError.cause.constraint.fields`에 컬럼명이 들어온다.
 * 구버전(`meta.target`)·테스트 환경과의 호환을 위해 여러 위치를 순서대로 확인한다.
 */
function getUniqueConstraintTarget(error) {
  const adapterFields = error?.meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields) && adapterFields.length > 0) {
    return adapterFields.join(",");
  }

  const target = error?.meta?.target;
  if (Array.isArray(target)) {
    return target.join(",");
  }
  if (target) {
    return String(target);
  }

  // 마지막 수단: 에러 메시지 문자열에서 필드명을 추출한다.
  // 예) "Unique constraint failed on the fields: (`user_id`)"
  const matched = /fields: \(([^)]+)\)/.exec(error?.message || "");
  return matched ? matched[1].replace(/[`\s]/g, "") : "";
}

module.exports = { getUniqueConstraintTarget };
