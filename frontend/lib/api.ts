import {
  ApiError,
  type ApiErrorPayload,
  type AuthResponse,
  type Message,
  type MessageListResponse,
  type PublicStream,
  type PublicStreamListResponse,
  type Session,
  type Stream,
  type StreamListResponse,
  type User,
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";

type RequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
  cache?: RequestCache;
};

function buildUrl(path: string) {
  if (!API_BASE_URL) {
    return path;
  }

  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

async function parseError(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.error || `Request failed with status ${response.status}`;
  }

  const text = (await response.text()).trim();
  return text || `Request failed with status ${response.status}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(buildUrl(path), {
    method: options.method || "GET",
    headers,
    cache: options.cache || "no-store",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new ApiError("Expected a JSON response from the API", response.status);
  }

  return (await response.json()) as T;
}

export async function register(input: {
  email: string;
  display_name: string;
  password: string;
}): Promise<User> {
  return request<User>("/auth/register", {
    method: "POST",
    body: input,
  });
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: input,
  });
}

export async function fetchCurrentUser(session: Session): Promise<User> {
  return request<User>("/auth/me", {
    token: session.token,
  });
}

export async function fetchStreams(session: Session): Promise<Stream[]> {
  const payload = await request<StreamListResponse>("/streams", {
    token: session.token,
  });

  return Array.isArray(payload.streams) ? payload.streams : [];
}

export async function fetchPublicStreams(): Promise<PublicStream[]> {
  const payload = await request<PublicStreamListResponse>("/public/streams");
  return Array.isArray(payload.streams) ? payload.streams : [];
}

export async function createStream(
  session: Session,
  input: {
    title: string;
    description: string;
  },
): Promise<Stream> {
  return request<Stream>("/streams", {
    method: "POST",
    token: session.token,
    body: input,
  });
}

export async function fetchStream(session: Session, streamId: string): Promise<Stream> {
  return request<Stream>(`/streams/${streamId}`, {
    token: session.token,
  });
}

export async function fetchPublicStream(streamId: string): Promise<PublicStream> {
  return request<PublicStream>(`/public/streams/${streamId}`);
}

export async function goLiveStream(session: Session, streamId: string): Promise<Stream> {
  return request<Stream>(`/streams/go-live/${streamId}`, {
    method: "POST",
    token: session.token,
  });
}

export async function endStream(session: Session, streamId: string): Promise<Stream> {
  return request<Stream>(`/streams/end/${streamId}`, {
    method: "POST",
    token: session.token,
  });
}

export async function deleteStream(session: Session, streamId: string): Promise<void> {
  await request<{ status: string }>(`/streams/delete/${streamId}`, {
    method: "POST",
    token: session.token,
  });
}

export async function fetchMessages(streamId: string): Promise<Message[]> {
  const payload = await request<MessageListResponse>(`/streams/${streamId}/messages`);
  return Array.isArray(payload.messages) ? payload.messages : [];
}

export async function postMessage(
  session: Session,
  streamId: string,
  body: string,
): Promise<Message> {
  return request<Message>(`/streams/${streamId}/messages`, {
    method: "POST",
    token: session.token,
    body: {
      author: session.user.display_name,
      body,
    },
  });
}

export function chatEventsUrl(streamId: string) {
  return buildUrl(`/streams/${streamId}/events`);
}
