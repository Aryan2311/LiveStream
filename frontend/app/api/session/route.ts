import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "live-platform-token";

export async function GET() {
  const store = await cookies();
  return Response.json({
    token: store.get(SESSION_COOKIE_NAME)?.value || null,
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { token?: string };
  const store = await cookies();

  if (!payload.token) {
    store.delete(SESSION_COOKIE_NAME);
    return Response.json({ ok: true });
  }

  store.set(SESSION_COOKIE_NAME, payload.token, {
    httpOnly: false,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return Response.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  return Response.json({ ok: true });
}
