import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isDashboard = createRouteMatcher([
  '/dashboard(.*)',
  '/api-keys(.*)',
  '/billing(.*)',
  '/memories(.*)',
  '/capabilities(.*)',
  '/settings(.*)',
  '/api/dashboard(.*)',
]);

const isAuthPage = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isDashboard(req)) {
    await auth.protect();
    return;
  }

  // Redirect already-signed-in users away from auth pages
  if (isAuthPage(req)) {
    const { userId } = await auth();
    if (userId) {
      const dashboard = new URL('/dashboard', req.url);
      return NextResponse.redirect(dashboard);
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|pdf)).*)',
    '/(api|trpc)(.*)',
  ],
};
