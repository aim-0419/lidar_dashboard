import { apiUrl } from "./config";

async function parseJson(response) {
  return response.json().catch(() => ({}));
}

// 백엔드 GET JSON 요청 공통 함수이다. 추후 인증 헤더가 필요하면 이 파일에서 함께 처리한다.
export async function getJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    ...options,
  });
  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.error || data.message || `GET ${path} failed`);
  }

  return data;
}

// 백엔드 POST JSON 요청 공통 함수이다. Content-Type과 에러 처리를 한 곳에서 관리한다.
export async function postJson(path, body = {}, options = {}) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: JSON.stringify(body),
    ...options,
  });
  const data = await parseJson(response);

  if (!response.ok || data.ok === false || data.success === false) {
    throw new Error(data.error || data.message || `POST ${path} failed`);
  }

  return data;
}

// 백엔드 PATCH JSON 요청 공통 함수이다. 인증 적용 후에는 같은 위치에서 토큰을 공통 처리한다.
export async function patchJson(path, body = {}, options = {}) {
  const response = await fetch(apiUrl(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: JSON.stringify(body),
    ...options,
  });
  const data = await parseJson(response);

  if (!response.ok || data.ok === false || data.success === false) {
    // 서버가 사용자용 메시지를 주지 않아도 API 경로 같은 내부 요청 정보는 화면에 노출하지 않는다.
    throw new Error(data.error || data.message || "요청 처리 중 오류가 발생했습니다.");
  }

  return data;
}
