import { auth } from '@/auth';
import { NextResponse } from 'next/server';

// D-05: Public paths that don't require authentication
const publicPaths = [
  '/',
  '/debug',
  '/api/auth',
  '/api/verify-proof',
  '/api/rp-signature',
];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// D-04: Middleware actively redirects unauthenticated users to landing page
export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow static assets
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to landing page
  if (!req.auth) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
