import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { message: 'API key is required' },
        { status: 401 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Validate API key
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

    // If key is valid, return protected data
    return NextResponse.json(
      { 
        message: 'Access granted',
        data: {
          timestamp: new Date().toISOString(),
          status: 'success'
        }
      },
      { status: 200 }
    );
  } catch  {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 