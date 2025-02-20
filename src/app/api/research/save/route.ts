import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current user's session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { query, research } = await request.json();

    // First save to research_reports table
    const { data: reportData, error: reportError } = await supabase
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
      })
      .select()
      .single();

    if (reportError) throw reportError;

    // Then save to saved_research table for quick access
    const { error: savedError } = await supabase
      .from('saved_research')
      .insert({
        user_id: session.user.id,
        research_data: {
          query,
          summary: research.summary,
          findings: research.findings,
          keyInsights: research.keyInsights,
          statistics: research.statistics,
          metadata: research.metadata
        },
        created_at: new Date().toISOString()
      });

    if (savedError) throw savedError;

    // Update API usage for the user
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('id, usage')
      .eq('user_id', session.user.id)
      .single();

    if (!apiKeyError && apiKeyData) {
      await supabase
        .from('api_keys')
        .update({ 
          usage: (apiKeyData.usage || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', apiKeyData.id);
    }

    return NextResponse.json({
      success: true,
      data: reportData,
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