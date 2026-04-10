const AUTH_STORAGE_KEY = "koduck.auth.token";
const AUTH_USER_STORAGE_KEY = "koduck.auth.user";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserInfo {
  id?: number;
  username?: string;
  email?: string;
  nickname?: string;
  avatarUrl?: string;
  avatar_url?: string;
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

function normalizeUser(raw: unknown): UserInfo | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  return {
    id: typeof value.id === "number" ? value.id : undefined,
    username: typeof value.username === "string" ? value.username : undefined,
    email: typeof value.email === "string" ? value.email : undefined,
    nickname: typeof value.nickname === "string" ? value.nickname : undefined,
    avatarUrl:
      typeof value.avatarUrl === "string"
        ? value.avatarUrl
        : typeof value.avatar_url === "string"
          ? value.avatar_url
          : undefined,
    roles: Array.isArray(value.roles)
      ? value.roles.filter((r): r is string => typeof r === "string")
      : undefined,
  };
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
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

export function getCurrentUser(): UserInfo | null {
  const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return normalizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setCurrentUser(user: UserInfo | null): void {
  if (!user) {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

export async function fetchCurrentUserProfile(): Promise<UserInfo | null> {
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(toApiUrl("/api/v1/users/me"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json().catch(() => null)) as
      | ApiResponse<UserInfo>
      | null;
    const user = normalizeUser(payload?.data);
    if (user) {
      setCurrentUser(user);
    }
    return user;
  } catch {
    return null;
  }
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

  const loginUser = normalizeUser(payload?.data?.user);
  if (loginUser) {
    setCurrentUser(loginUser);
  } else {
    await fetchCurrentUserProfile();
  }
}
