import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    // Store API key in secure cookie
    // cookies().set('research_api_key', apiKey, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: 'strict',
    //   maxAge: 60 * 60 * 24 * 30 // 30 days
    // });

    // Validate key exists in database
    const { data, error } = await supabase
      .from('api_keys')
      .select('id')
      .eq('key', apiKey)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { message: 'Invalid API key' },
        { status: 401 }
      );
    }

    return NextResponse.json({ message: 'API key validated successfully' });
  } catch  {
    return NextResponse.json(
      { message: 'Failed to validate API key' },
      { status: 500 }
    );
  }
} 