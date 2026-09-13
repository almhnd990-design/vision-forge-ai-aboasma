import { NextRequest, NextResponse } from "next/server";
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-ghost-locale",
    request.nextUrl.pathname.split("/")[1] === "ar" ? "ar" : "en",
  );
  return NextResponse.next({ request: { headers: requestHeaders } });
}
export const config = { matcher: ["/((?!api|_next|brand|favicon.ico).*)"] };
