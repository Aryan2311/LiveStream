import type { NextRequest } from "next/server";

import { proxyToApi } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyToApi(request, `/public/streams/${id}`);
}
