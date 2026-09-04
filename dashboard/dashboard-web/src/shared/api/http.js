import axios from "axios";
import { API_BASE, apiUrl } from "./config";

let unauthorizedHandler = null;
let refreshPromise = null;
let accessToken = "";
const DEFAULT_REQUEST_ERROR_MESSAGE = "요청 처리에 실패했습니다.";

// Axios 오류 객체를 화면에서 다루기 쉬운 형태로 정리한다.
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
  // accessToken은 브라우저 저장소가 아니라 메모리에만 유지한다.
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

// 현재 accessToken이 만료되면 refresh cookie를 이용해 다시 발급받는다.
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

  // 메모리에 보관 중인 accessToken을 Authorization 헤더에 붙인다.
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
      // 여러 요청이 동시에 401로 실패해도 refresh 요청은 한 번만 보낸다.
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
    throw normalizeError(error, DEFAULT_REQUEST_ERROR_MESSAGE);
  }
}

export async function postJson(path, body = {}, options = {}) {
  try {
    const response = await http.post(path, body, {
      ...options,
      headers: options.headers || {},
    });

    if (response.data?.ok === false || response.data?.success === false) {
      throw new Error(response.data?.message || response.data?.error || DEFAULT_REQUEST_ERROR_MESSAGE);
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error, DEFAULT_REQUEST_ERROR_MESSAGE);
  }
}

export async function patchJson(path, body = {}, options = {}) {
  try {
    const response = await http.patch(path, body, {
      ...options,
      headers: options.headers || {},
    });

    if (response.data?.ok === false || response.data?.success === false) {
      throw new Error(response.data?.message || response.data?.error || DEFAULT_REQUEST_ERROR_MESSAGE);
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error, DEFAULT_REQUEST_ERROR_MESSAGE);
  }
}

export async function deleteJson(path, options = {}) {
  try {
    const response = await http.delete(path, {
      ...options,
      headers: options.headers || {},
    });

    if (response.data?.ok === false || response.data?.success === false) {
      throw new Error(response.data?.message || response.data?.error || DEFAULT_REQUEST_ERROR_MESSAGE);
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error, DEFAULT_REQUEST_ERROR_MESSAGE);
  }
}

export async function logoutRequest() {
  try {
    await http.post("/api/auth/logout", {});
  } catch (error) {
    throw normalizeError(error, DEFAULT_REQUEST_ERROR_MESSAGE);
  }
}

export async function fetchMyProfile() {
  const response = await getJson("/api/auth/me");
  return response.user;
}

export async function loginRequest(credentials) {
  return postJson("/api/auth/login", credentials);
}

// 대시보드 소켓 연결 전에 짧은 수명의 WebSocket 티켓을 발급받는다.
export async function fetchWebSocketTicket() {
  return postJson("/api/auth/ws-ticket", {});
}

export async function fetchUsers(options = {}) {
  const searchParams = new URLSearchParams();

  if (options.page) {
    searchParams.set("page", String(options.page));
  }

  if (options.limit) {
    searchParams.set("limit", String(options.limit));
  }

  if (options.keyword) {
    searchParams.set("keyword", options.keyword);
  }

  if (typeof options.isActive === "boolean") {
    searchParams.set("isActive", String(options.isActive));
  }

  const query = searchParams.toString();
  return getJson(`/api/users${query ? `?${query}` : ""}`);
}

export async function fetchStatisticsSummary(period, options = {}) {
  const searchParams = new URLSearchParams();

  if (period) {
    searchParams.set("period", period);
  }

  if (options.startDate) {
    searchParams.set("startDate", options.startDate);
  }

  if (options.endDate) {
    searchParams.set("endDate", options.endDate);
  }

  if (options.siteId) {
    searchParams.set("siteId", options.siteId);
  }

  if (options.zoneId) {
    searchParams.set("zoneId", options.zoneId);
  }

  const query = searchParams.toString();
  return getJson(`/api/statistics/summary${query ? `?${query}` : ""}`);
}

export async function fetchTrafficSeries(period, options = {}) {
  const searchParams = new URLSearchParams();

  if (period) {
    searchParams.set("period", period);
  }

  if (options.startDate) {
    searchParams.set("startDate", options.startDate);
  }

  if (options.endDate) {
    searchParams.set("endDate", options.endDate);
  }

  if (options.siteId) {
    searchParams.set("siteId", options.siteId);
  }

  if (options.zoneId) {
    searchParams.set("zoneId", options.zoneId);
  }

  const query = searchParams.toString();
  return getJson(`/api/statistics/traffic-series${query ? `?${query}` : ""}`);
}

export async function fetchDashboardState() {
  return getJson("/api/state");
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

export async function verifyUserPasswordRequest(id, payload) {
  return postJson(`/api/users/${id}/password/verify`, payload);
}

export async function updateUserPasswordRequest(id, payload) {
  return patchJson(`/api/users/${id}/password`, payload);
}

export async function resetUserPasswordRequest(id, payload) {
  return patchJson(`/api/users/${id}/password/reset`, payload);
}

export async function deactivateUserRequest(id) {
  return deleteJson(`/api/users/${id}`);
}

export async function createSignupRequest(payload) {
  return postJson("/api/signup-requests", payload);
}

export async function checkSignupRequestUserId(userId) {
  const query = new URLSearchParams({ userId: String(userId || "").trim() });
  return getJson(`/api/signup-requests/availability?${query.toString()}`);
}

export async function fetchSignupRequests(status, page = 1, limit = 20) {
  const query = new URLSearchParams();

  if (status) {
    query.set("status", status);
  }

  query.set("page", String(page));
  query.set("limit", String(limit));

  return getJson(`/api/signup-requests?${query.toString()}`);
}

export async function approveSignupRequest(id) {
  return patchJson(`/api/signup-requests/${id}/approve`);
}

export async function rejectSignupRequest(id, rejectReason) {
  return patchJson(`/api/signup-requests/${id}/reject`, { rejectReason });
}

export async function initializeAccessToken() {
  // 새로고침 후 메모리 토큰이 비어 있으면 refresh cookie로 다시 복구한다.
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
