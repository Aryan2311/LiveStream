import type { NextRequest } from "next/server";

import { proxyToApi } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyToApi(request, "/public/streams");
}
