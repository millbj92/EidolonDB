import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isDashboard = createRouteMatcher([
  '/dashboard(.*)',
  '/api-keys(.*)',
  '/billing(.*)',
  '/memories(.*)',
  '/settings(.*)',
  '/api/dashboard(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isDashboard(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|pdf)).*)',
    '/(api|trpc)(.*)',
  ],
};
