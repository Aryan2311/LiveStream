export type User = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
};

export type Session = {
  token: string;
  user: User;
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type Stream = {
  id: string;
  title: string;
  description: string;
  stream_key: string;
  owner_id: string;
  status: "created" | "live" | "ended";
  playback_url: string;
  rtmp_url: string;
  whip_url: string;
  ingest_callback_url?: string;
  created_at: string;
  updated_at: string;
};

export type PublicStream = {
  id: string;
  title: string;
  description: string;
  status: "created" | "live" | "ended";
  playback_url: string;
  created_at: string;
  updated_at: string;
};

export type StreamListResponse = {
  streams: Stream[];
};

export type PublicStreamListResponse = {
  streams: PublicStream[];
};

export type Message = {
  id: string;
  stream_id: string;
  user_id: string;
  author: string;
  body: string;
  created_at: string;
};

export type MessageListResponse = {
  messages: Message[];
};

export type ApiErrorPayload = {
  error?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
