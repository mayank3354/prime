import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { summarizeReadme } from '@/lib/chain';

export async function POST(request: Request) {
  try {
    // Get API key from headers
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

    // Get request body
    const { repoUrl } = await request.json();

    if (!repoUrl) {
      return NextResponse.json(
        { message: 'Repository URL is required' },
        { status: 400 }
      );
    }

    // Increment usage
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ usage: data.usage + 1 })
      .eq('id', data.id);

    if (updateError) {
      console.error('Failed to update API key usage:', updateError);
    }

    // Fetch repository README content
    const readmeContent = await getReadme(repoUrl);

    if (!readmeContent) {
      return NextResponse.json(
        { message: 'Failed to fetch repository README' },
        { status: 404 }
      );
    }

    // Generate summary using LangChain
    const summary = await summarizeReadme(readmeContent);

    return NextResponse.json({
      message: "Github Summarization completed",
      summary
    });

  } catch (error) {
    console.error('GitHub Summarizer Error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getReadme(repoUrl: string): Promise<string | null> {
    try {
        const owner = repoUrl.split('/')[3];
        const repo = repoUrl.split('/')[4];
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;

        const readmeResponse = await fetch(
            apiUrl,
            {
                headers: {
                    'Accept': 'application/vnd.github.v3.raw',
                    'User-Agent': 'GitHub-Summarizer'
                }
            }
        );

        if (!readmeResponse.ok) {
            if (readmeResponse.status !== 404) {
                console.error('Failed to fetch README:', readmeResponse.statusText);
            }
            return null;
        }

        return await readmeResponse.text();
    } catch (error) {
        console.error('Error fetching README:', error);
        return null;
    }
}

