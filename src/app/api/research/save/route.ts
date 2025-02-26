import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { query, research } = await request.json();
    
    // Debug the incoming data
    console.log('Saving research data:', JSON.stringify({
      query,
      researchKeys: research ? Object.keys(research) : 'research is undefined',
      researchType: research ? typeof research : 'undefined'
    }));
    
    if (!query || !research) {
      return NextResponse.json(
        { message: 'Query and research data are required' },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create a sanitized version of the research data with fallbacks
    const sanitizedResearch = {
      summary: typeof research.summary === 'string' ? research.summary : '',
      findings: Array.isArray(research.findings) ? research.findings : [],
      key_insights: Array.isArray(research.keyInsights) ? research.keyInsights : [],
      statistics: Array.isArray(research.statistics) ? research.statistics : [],
      code_examples: Array.isArray(research.codeExamples) ? research.codeExamples : [],
      suggested_questions: Array.isArray(research.suggestedQuestions) ? research.suggestedQuestions : [],
      metadata: research.metadata || {}
    };

    // Insert research report with sanitized data
    const { data, error } = await supabase
      .from('research_reports')
      .insert({
        user_id: session.user.id,
        query: query,
        summary: sanitizedResearch.summary,
        findings: sanitizedResearch.findings,
        key_insights: sanitizedResearch.key_insights,
        statistics: sanitizedResearch.statistics,
        code_examples: sanitizedResearch.code_examples,
        suggested_questions: sanitizedResearch.suggested_questions,
        metadata: sanitizedResearch.metadata,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Save error:', error);
      return NextResponse.json(
        { message: 'Failed to save research', error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Research saved successfully',
      data 
    });
  } catch (error) {
    console.error('Save handler error:', error);
    return NextResponse.json(
      { message: 'An error occurred', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 