import type { NextRequest } from "next/server";

import { proxyToApi } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToApi(request, `/hls/${path.join("/")}`);
}

export { handle as GET, handle as HEAD };
