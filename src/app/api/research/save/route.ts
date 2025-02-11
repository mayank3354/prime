import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const researchData = await request.json();

    // Get the current user's session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Save to research_reports table
    const { error: reportsError } = await supabase
      .from('research_reports')
      .insert({
        user_id: session.user.id,
        query: researchData.query,
        summary: researchData.summary,
        findings: researchData.findings,
        metadata: {
          sourcesCount: researchData.metadata?.sourcesCount || 0,
          confidence: researchData.metadata?.confidence || 0
        },
        created_at: new Date().toISOString(),
      });

    if (reportsError) {
      console.error('Error saving to research_reports:', reportsError);
      return NextResponse.json(
        { message: 'Failed to save research report' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Research report saved successfully',
      saved: true 
    });

  } catch (error) {
    console.error('Save research error:', error);
    return NextResponse.json(
      { message: 'Failed to save research report' },
      { status: 500 }
    );
  }
} 