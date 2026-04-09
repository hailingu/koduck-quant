const AUTH_STORAGE_KEY = "koduck.auth.token";

export interface LoginRequest {
  username: string;
  password: string;
}

interface UserInfo {
  id?: number;
  username?: string;
  email?: string;
  nickname?: string;
  avatarUrl?: string;
  roles?: string[];
}

interface TokenResponse {
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  tokenType?: string;
  token_type?: string;
  expiresIn?: number;
  expires_in?: number;
  user?: UserInfo;
}

interface ApiResponse<T> {
  success?: boolean;
  code?: number;
  message?: string;
  data?: T;
}

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";

function toApiUrl(path: string): string {
  if (!API_BASE_URL) {
    return path;
  }
  const base = API_BASE_URL.replace(/\/$/, "");
  if (base.endsWith("/api") && path.startsWith("/api/")) {
    return `${base}${path.slice(4)}`;
  }
  return `${base}${path}`;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function login(request: LoginRequest): Promise<void> {
  const response = await fetch(toApiUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<TokenResponse>
    | null;

  if (!response.ok) {
    const message = payload?.message || "登录失败，请检查用户名和密码";
    throw new Error(message);
  }

  const accessToken = payload?.data?.accessToken ?? payload?.data?.access_token;
  if (!accessToken) {
    throw new Error("登录响应缺少 access token");
  }

  localStorage.setItem(AUTH_STORAGE_KEY, accessToken);
}
