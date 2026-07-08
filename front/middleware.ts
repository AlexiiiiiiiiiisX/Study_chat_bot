import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/admin"];
const publicAuthRoutes = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuthSentinel = request.cookies.get("study_chat_auth")?.value === "1";

  if (protectedRoutes.some((route) => pathname.startsWith(route)) && !hasAuthSentinel) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (publicAuthRoutes.includes(pathname) && hasAuthSentinel) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register"]
};
