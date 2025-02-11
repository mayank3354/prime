import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

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

    // Validate API key and get current usage
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select('id, usage, monthly_limit, is_monthly_limit')
      .eq('key', apiKey)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json(
        { message: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Check usage limits
    if (keyData.is_monthly_limit && keyData.usage >= keyData.monthly_limit) {
      return NextResponse.json(
        { message: 'Monthly API limit exceeded' },
        { status: 429 }
      );
    }

    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { message: 'Query is required' },
        { status: 400 }
      );
    }

    // Initialize the model and tools
    const model = new ChatGoogleGenerativeAI({
      modelName: "gemini-pro",
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.3,
    });

    const searchTool = new TavilySearchResults({
      apiKey: process.env.TAVILY_API_KEY!,
    });

    // Perform search
    const searchResults = await searchTool.invoke(query);

    // Generate research response
    const response = await model.invoke(
      `Analyze these search results and provide a detailed research summary with key findings:
      Search Query: ${query}
      Search Results: ${JSON.stringify(searchResults)}
      
      Format the response as:
      {
        "summary": "concise overview",
        "findings": [
          {
            "content": "key finding",
            "source": "source url",
            "relevance": "High/Medium/Low",
            "credibility": 0.9
          }
        ],
        "suggestedQuestions": ["follow-up question 1", "follow-up question 2"],
        "metadata": {
          "sourcesCount": 5,
          "confidence": 0.85
        }
      }`
    );

    console.log('LLM Response:', response.content);

    // Parse the response
    const research = JSON.parse(response.content as string);

    // Increment API usage
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ 
        usage: (keyData.usage || 0) + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', keyData.id);

    if (updateError) {
      console.error('Failed to update API usage:', updateError);
    }

    return NextResponse.json({ research });

  } catch (error) {
    console.error('Research error:', error);
    return NextResponse.json(
      { message: 'Research failed', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 