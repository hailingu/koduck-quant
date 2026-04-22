const AUTH_STORAGE_KEY = "koduck.auth.token";
const AUTH_USER_STORAGE_KEY = "koduck.auth.user";

export interface LoginRequest {
  username: string;
  password: string;
  tenant_id?: string;
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

interface AvatarUploadResponse {
  avatarUrl?: string;
  avatar_url?: string;
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

function mergeCurrentUser(patch: Partial<UserInfo>): UserInfo | null {
  const currentUser = getCurrentUser();
  const nextUser = currentUser ? { ...currentUser, ...patch } : normalizeUser(patch);
  if (nextUser) {
    setCurrentUser(nextUser);
  }
  return nextUser;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function userFromJwtPayload(payload: Record<string, unknown>): UserInfo | null {
  const username = typeof payload.username === "string" ? payload.username : undefined;
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const sub = payload.sub;
  const id =
    typeof sub === "string" && /^\d+$/.test(sub)
      ? Number(sub)
      : typeof sub === "number"
        ? sub
        : undefined;

  if (!username && !email && typeof id === "undefined") {
    return null;
  }

  return {
    id,
    username,
    email,
  };
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return true;
  }
  const exp = payload.exp;
  if (typeof exp !== "number") {
    return true;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds;
}

export function isAuthenticated(): boolean {
  const token = getAccessToken();
  if (!token) {
    return false;
  }
  return !isTokenExpired(token);
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
    if (response.status === 401) {
      // Only force logout when token itself is actually expired.
      // Some environments may have /users/me auth mismatch while login token is still valid.
      if (isTokenExpired(token)) {
        clearAuth();
        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
      }
      return null;
    }
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
    const tokenPayload = decodeJwtPayload(accessToken);
    const fallbackUser = tokenPayload ? userFromJwtPayload(tokenPayload) : null;
    if (fallbackUser) {
      setCurrentUser(fallbackUser);
    }
  }

  await fetchCurrentUserProfile().catch(() => null);
}

export async function uploadCurrentUserAvatar(file: File): Promise<string> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("当前未登录");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(toApiUrl("/api/v1/users/me/avatar"), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<AvatarUploadResponse>
    | null;

  if (!response.ok) {
    throw new Error(payload?.message || "头像上传失败，请稍后重试");
  }

  const avatarUrl = payload?.data?.avatarUrl ?? payload?.data?.avatar_url;
  if (!avatarUrl) {
    throw new Error("头像上传成功，但响应缺少头像地址");
  }

  mergeCurrentUser({ avatarUrl });
  return avatarUrl;
}

export async function resolveAvatarImageSrc(avatarUrl: string): Promise<string> {
  if (
    avatarUrl.startsWith("data:")
    || avatarUrl.startsWith("blob:")
    || avatarUrl.startsWith("http://")
    || avatarUrl.startsWith("https://")
  ) {
    return avatarUrl;
  }

  const token = getAccessToken();
  const response = await fetch(toApiUrl(avatarUrl), {
    method: "GET",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  if (!response.ok) {
    throw new Error("头像加载失败");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
