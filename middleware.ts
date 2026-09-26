import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  poisonResponseInit,
  renderPoisonBody,
  shouldPoisonScrape,
} from "@/lib/scrape-guard";

export function middleware(request: NextRequest) {
  const decision = shouldPoisonScrape({
    pathname: request.nextUrl.pathname,
    method: request.method,
    userAgent: request.headers.get("user-agent"),
    accept: request.headers.get("accept"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });

  if (!decision.poison) {
    return NextResponse.next();
  }

  return new NextResponse(
    renderPoisonBody(decision.asJson),
    poisonResponseInit(decision.asJson),
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
