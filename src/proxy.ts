import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";
import { canAccess, ROLE_HOME } from "@/lib/roles";

/**
 * Primeira barreira (leve, sem banco): redireciona conforme o nível
 * gravado no cookie. A verificação definitiva (usuário ativo, nível atual)
 * é feita nas páginas e actions via `lib/dal.ts`.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(session ? ROLE_HOME[session.role] : "/login", request.url),
    );
  }

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
    }
    return NextResponse.next();
  }

  // /admin e /sistema
  if (!session) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (!canAccess(session.role, pathname)) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/sistema/:path*"],
};
