import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { researchAgent } from '../../../lib/agents/research';

export async function POST(request: Request) {
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
      .select('id, usage, monthly_limit, is_monthly_limit')
      .eq('key', apiKey)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { message: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Check usage limits
    if (data.is_monthly_limit && data.usage >= data.monthly_limit) {
      return NextResponse.json(
        { message: 'Monthly API limit exceeded' },
        { status: 429 }
      );
    }

    const { query } = await request.json();

    if (!query) {
      return NextResponse.json(
        { message: 'Research query is required' },
        { status: 400 }
      );
    }

    // Perform research using LangChain agent
    const research = await researchAgent(query);

    // Increment usage
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ usage: data.usage + 1 })
      .eq('id', data.id);

    if (updateError) {
      console.error('Failed to update API key usage:', updateError);
    }

    return NextResponse.json({ research });

  } catch (error) {
    console.error('Research Error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 