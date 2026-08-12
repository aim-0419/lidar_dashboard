import axios from "axios";
import { API_BASE, apiUrl } from "./config";

let unauthorizedHandler = null;
let refreshPromise = null;
let accessToken = "";

// axios 에러를 화면에서 다루기 쉬운 Error 객체 형태로 정리합니다.
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
  // access token은 브라우저 저장소가 아니라 메모리에만 보관합니다.
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

// 현재 access token이 만료되면 refresh cookie로 새 access token을 발급받습니다.
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

  // 메모리에 있는 access token을 Authorization 헤더에 자동으로 붙입니다.
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
      // 여러 요청이 동시에 401이 나면 refresh 요청은 한 번만 보내고 결과를 함께 사용합니다.
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

export async function fetchUsers() {
  return getJson("/api/users");
}

export async function fetchStatisticsSummary(period, options = {}) {
  const searchParams = new URLSearchParams();

  if (period) {
    searchParams.set("period", period);
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

export async function updateUserPasswordRequest(id, payload) {
  return patchJson(`/api/users/${id}/password`, payload);
}

export async function deactivateUserRequest(id) {
  return deleteJson(`/api/users/${id}`);
}

export async function initializeAccessToken() {
  // 메모리에 토큰이 없으면 refresh cookie를 이용해 access token을 다시 복구합니다.
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
