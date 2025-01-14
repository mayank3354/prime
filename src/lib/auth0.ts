// import { getSession } from '@auth0/nextjs-auth0';
// import { NextResponse } from 'next/server';

// export async function getAuth0Session(request: Request) {
//   try {
//     const session = await getSession();
//     return session;
//   } catch {
//     return null;
//   }
// }

// export function redirectToLogin(returnTo?: string) {
//   const searchParams = new URLSearchParams();
//   if (returnTo) {
//     searchParams.set('returnTo', returnTo);
//   }
//   return NextResponse.redirect(new URL(`/api/auth/login?${searchParams.toString()}`, process.env.AUTH0_BASE_URL));
// } 