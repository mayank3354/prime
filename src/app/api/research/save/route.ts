import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { query, research } = await request.json();

    // Get the current user's session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Save to research_reports table
    const { data, error } = await supabase
      .from('research_reports')
      .insert({
        user_id: session.user.id,
        query,
        summary: research.summary,
        findings: research.findings,
        key_insights: research.keyInsights,
        statistics: research.statistics || [],
        metadata: research.metadata,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { message: 'Failed to save research', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: 'Research saved successfully' 
    });

  } catch (error) {
    console.error('Save error:', error);
    return NextResponse.json(
      { message: 'Failed to save research' },
      { status: 500 }
    );
  }
} 