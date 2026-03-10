import { NextRequest } from "next/server";

const API_PROXY_TARGET = process.env.API_PROXY_TARGET?.trim() || "http://localhost:8080";

function buildTarget(pathname: string, search: string) {
  const base = API_PROXY_TARGET.replace(/\/$/, "");
  return `${base}${pathname}${search}`;
}

export async function proxyToApi(request: NextRequest, pathname: string) {
  const upstreamURL = buildTarget(pathname, request.nextUrl.search);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("expect");
  headers.set("x-forwarded-host", request.headers.get("host") || "");
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(upstreamURL, init);
  const responseHeaders = new Headers(upstream.headers);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
