import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';


export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { query, research } = await request.json();

    // Save to research_reports table
    const { data, error } = await supabase
      .from('research_reports')
      .insert({
        user_id: session.user.id,
        query: query,
        summary: research.summary,
        findings: research.findings,
        key_insights: research.keyInsights,
        statistics: research.statistics || [],
        suggested_questions: research.suggestedQuestions || [],
        metadata: research.metadata,
        created_at: new Date().toISOString(),
        mode: research.mode || 'web' // 'web' or 'academic'
      })
      .select()
      .single();

    if (error) {
      console.error('Save error:', error);
      return NextResponse.json(
        { message: 'Failed to save research', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Research saved successfully',
      report: data
    });

  } catch (error) {
    console.error('Save handler error:', error);
    return NextResponse.json(
      { message: 'Failed to save research', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 