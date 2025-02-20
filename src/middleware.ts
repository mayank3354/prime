import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Public routes that don't require authentication
    const publicRoutes = [
      '/auth/login',
      '/auth/signup',
      '/auth/verify-email',
      '/auth/forgot-password',
      '/auth/callback',
      '/api/validate-key',
      '/api/github-summarizer',
      '/api/protected'
    ];

    const isPublicRoute = publicRoutes.some(route => 
      req.nextUrl.pathname.startsWith(route)
    );

    // Allow access to public routes and static files
    if (isPublicRoute || req.nextUrl.pathname.startsWith('/_next/')) {
      return res;
    }

    // Check if user has API keys
    if (session?.user) {
      const { data: apiKeys } = await supabase
        .from('api_keys')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      // If no API keys exist, create default one
      if (!apiKeys) {
        const newKey = `prime_${Math.random().toString(36).substr(2, 16)}`;
        await supabase
          .from('api_keys')
          .insert({
            user_id: session.user.id,
            name: 'default',
            key: newKey,
            monthly_limit: 1000,
            is_monthly_limit: true,
            usage: 0,
            created_at: new Date().toISOString()
          });
      }
    }

    // Redirect to login if accessing protected route without session
    if (!session && !isPublicRoute) {
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }

    // Redirect to dashboard if accessing auth pages while logged in
    if (session && req.nextUrl.pathname.startsWith('/auth/')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}; 