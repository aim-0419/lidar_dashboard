import axios from "axios";
import { API_BASE, apiUrl } from "./config";

let unauthorizedHandler = null;
let refreshPromise = null;
let accessToken = "";

// Axios 에러 객체를 UI에서 다루기 쉬운 형태로 정리합니다.
function normalizeError(error, fallbackMessage) {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallbackMessage;

  const normalizedError = new Error(message);
  normalizedError.status = error?.response?.status;
  normalizedError.originalError = error;
  return normalizedError;
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  // accessToken은 브라우저 저장소 대신 메모리 변수에만 유지합니다.
  accessToken = token || "";
}

export function clearAccessToken() {
  setAccessToken("");
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// 기존 accessToken이 없거나 만료되면 refresh cookie로 새 accessToken을 발급받습니다.
async function requestTokenRefresh() {
  const response = await axios.post(
    apiUrl("/api/auth/refresh"),
    {},
    {
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const nextAccessToken = response?.data?.accessToken || "";

  if (!nextAccessToken) {
    throw new Error("Failed to refresh access token.");
  }

  setAccessToken(nextAccessToken);
  return nextAccessToken;
}

http.interceptors.request.use((config) => {
  const nextConfig = { ...config };
  nextConfig.headers = nextConfig.headers || {};

  // 현재 메모리에 올라와 있는 accessToken을 Authorization 헤더에 붙입니다.
  if (accessToken) {
    nextConfig.headers.Authorization = `Bearer ${accessToken}`;
  }

  return nextConfig;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const requestUrl = originalRequest.url || "";
    const isAuthRequest =
      requestUrl.includes("/api/auth/login") ||
      requestUrl.includes("/api/auth/refresh") ||
      requestUrl.includes("/api/auth/logout");

    if (error?.response?.status !== 401 || originalRequest._retry || isAuthRequest) {
      throw error;
    }

    originalRequest._retry = true;

    try {
      // 여러 요청이 동시에 401이어도 refresh 요청은 한 번만 보내고 결과를 공유합니다.
      if (!refreshPromise) {
        refreshPromise = requestTokenRefresh().finally(() => {
          refreshPromise = null;
        });
      }

      const nextAccessToken = await refreshPromise;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;

      return http(originalRequest);
    } catch (refreshError) {
      clearAccessToken();

      if (typeof unauthorizedHandler === "function") {
        unauthorizedHandler();
      }

      throw refreshError;
    }
  },
);

export async function getJson(path, options = {}) {
  try {
    const response = await http.get(path, {
      ...options,
      headers: options.headers || {},
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error, `GET ${path} failed`);
  }
}

export async function postJson(path, body = {}, options = {}) {
  try {
    const response = await http.post(path, body, {
      ...options,
      headers: options.headers || {},
    });

    if (response.data?.ok === false || response.data?.success === false) {
      throw new Error(response.data?.message || response.data?.error || `POST ${path} failed`);
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error, `POST ${path} failed`);
  }
}

export async function patchJson(path, body = {}, options = {}) {
  try {
    const response = await http.patch(path, body, {
      ...options,
      headers: options.headers || {},
    });

    if (response.data?.ok === false || response.data?.success === false) {
      throw new Error(response.data?.message || response.data?.error || `PATCH ${path} failed`);
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error, `PATCH ${path} failed`);
  }
}

export async function deleteJson(path, options = {}) {
  try {
    const response = await http.delete(path, {
      ...options,
      headers: options.headers || {},
    });

    if (response.data?.ok === false || response.data?.success === false) {
      throw new Error(response.data?.message || response.data?.error || `DELETE ${path} failed`);
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error, `DELETE ${path} failed`);
  }
}

export async function logoutRequest() {
  try {
    await http.post("/api/auth/logout", {});
  } catch (error) {
    throw normalizeError(error, "Failed to log out.");
  }
}

export async function fetchMyProfile() {
  const response = await getJson("/api/auth/me");
  return response.user;
}

export async function loginRequest(credentials) {
  return postJson("/api/auth/login", credentials);
}

// 대시보드 websocket 연결 전에 사용할 접속 티켓을 요청한다. 
export async function fetchWebSocketTicket() {
  return postJson("/api/auth/ws-ticket", {});
}

export async function fetchUsers() {
  return getJson("/api/users");
}

export async function fetchUserDetail(id) {
  return getJson(`/api/users/${id}`);
}

export async function createUserRequest(payload) {
  return postJson("/api/users", payload);
}

export async function updateUserRequest(id, payload) {
  return patchJson(`/api/users/${id}`, payload);
}

export async function updateUserPasswordRequest(id, payload) {
  return patchJson(`/api/users/${id}/password`, payload);
}

export async function deactivateUserRequest(id) {
  return deleteJson(`/api/users/${id}`);
}

export async function initializeAccessToken() {
  // 새로고침 후 메모리 토큰이 비어 있으면 refresh cookie로 다시 복구합니다.
  if (accessToken) {
    return accessToken;
  }

  try {
    return await requestTokenRefresh();
  } catch {
    clearAccessToken();
    return "";
  }
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
