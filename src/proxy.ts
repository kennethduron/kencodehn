import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  CRM_PREVIEW_READ_ONLY_MESSAGE,
  isCrmPreviewReadOnly,
  isPreviewMutationAllowed,
  isPreviewSafeMethod,
} from "@/lib/data/preview-read-only";

export function proxy(request: NextRequest) {
  if (!isCrmPreviewReadOnly()) return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  const cronMutation = pathname.startsWith("/api/cron/");
  const safeRequest = isPreviewSafeMethod(request.method) && !cronMutation;
  if (safeRequest || isPreviewMutationAllowed(pathname, request.method)) {
    return NextResponse.next();
  }

  return NextResponse.json(
    { ok: false, readOnly: true, message: CRM_PREVIEW_READ_ONLY_MESSAGE },
    {
      status: 423,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Ken-Code-Preview-Read-Only": "true",
      },
    },
  );
}

export const config = {
  matcher: "/api/:path*",
};
