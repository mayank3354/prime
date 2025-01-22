import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id')
      .eq('key', apiKey)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json(
        { message: 'Invalid API key' },
        { status: 401 }
      );
    }

    const researchData = await request.json();

    // Save research report with renamed field
    const { error: saveError } = await supabase
      .from('research_reports')
      .insert({
        query: researchData.query,
        summary: researchData.summary,
        findings: researchData.findings,
        reference_list: researchData.references,
        created_at: new Date().toISOString(),
      });

    if (saveError) {
      console.error('Error saving research:', saveError);
      return NextResponse.json(
        { message: 'Failed to save research report' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Research report saved successfully' });

  } catch (error) {
    console.error('Save research error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 