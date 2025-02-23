import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

function sanitizeJsonString(str: string): string {
  return str
    // Remove markdown formatting
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    // Replace line breaks with spaces
    .replace(/\n/g, ' ')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Fix any broken quotes
    .replace(/[""]/g, '"')
    // Escape any remaining special characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
}

export class ResearchAgent {
  private model: ChatGoogleGenerativeAI;
  private searchTool: TavilySearchResults;

  constructor() {
    this.model = new ChatGoogleGenerativeAI({
      modelName: "gemini-pro",
      apiKey: process.env.GOOGLE_API_KEY!,
      temperature: 0.3,
      maxOutputTokens: 2048,
    });

    this.searchTool = new TavilySearchResults({
      apiKey: process.env.TAVILY_API_KEY!,
    });
  }

  async research(query: string) {
    try {
      const searchResults = await this.searchTool.invoke(query);
      
      const systemPrompt = `You are a research assistant. Analyze the search results and provide a research report about "${query}". 
      Format your response as a JSON object with this exact structure:
      {
        "summary": "Brief but comprehensive summary",
        "findings": [
          {
            "title": "Main point",
            "content": "Detailed explanation",
            "source": "URL",
            "relevance": "High",
            "credibility": 0.9,
            "type": "text",
            "category": "Research"
          }
        ],
        "keyInsights": [
          {
            "point": "Key insight",
            "explanation": "Detailed explanation",
            "supportingEvidence": ["Evidence point 1", "Evidence point 2"]
          }
        ],
        "statistics": [
          {
            "value": "Specific numerical data",
            "metric": "What this number measures",
            "context": "Why this statistic is important",
            "source": "Source URL"
          }
        ],
        "suggestedQuestions": [
          "Follow-up question 1?",
          "Follow-up question 2?",
          "Follow-up question 3?"
        ],
        "metadata": {
          "sourcesCount": ${searchResults.length},
          "confidence": 0.9,
          "researchDepth": "comprehensive",
          "lastUpdated": "${new Date().toISOString()}"
        }
      }`;

      const response = await this.model.invoke([
        ["system", systemPrompt],
        ["human", `Search results: ${JSON.stringify(searchResults)}`]
      ]);

      let cleanedResponse = response.text;
      cleanedResponse = cleanedResponse.replace(/```json\n?|```\n?/g, '');
      cleanedResponse = sanitizeJsonString(cleanedResponse);

      const parsedResponse = JSON.parse(cleanedResponse);

      // Ensure metadata exists
      if (!parsedResponse.metadata) {
        parsedResponse.metadata = {
          sourcesCount: searchResults.length,
          confidence: 0.9,
          researchDepth: "comprehensive",
          lastUpdated: new Date().toISOString()
        };
      }

      return parsedResponse;

    } catch (error) {
      console.error('Research error:', error);
      throw new Error('Failed to process research results');
    }
  }

  async try(request: Request) {
    try {
      const apiKey = request.headers.get('x-api-key');
      if (!apiKey) {
        return NextResponse.json(
          { message: 'API key is required' },
          { status: 401 }
        );
      }

      const supabase = createRouteHandlerClient({ cookies });
      const { query } = await request.json();
      
      if (!query) {
        return NextResponse.json(
          { message: 'Query is required' },
          { status: 400 }
        );
      }

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

      // Initialize the model
      const model = new ChatGoogleGenerativeAI({
        modelName: "gemini-pro",
        apiKey: process.env.GOOGLE_API_KEY!,
        temperature: 0.3,
      });

      const searchTool = new TavilySearchResults({
        apiKey: process.env.TAVILY_API_KEY!,
      });

      // Perform search
      const searchResults = await searchTool.invoke(query);

      // First, get relevant images
      const imageSearchResults = await searchTool.invoke(`${query} relevant images diagrams infographics`);
      
      // Generate research response with a generic, comprehensive prompt
      const response = await model.invoke(
        `You are an expert research analyst. Provide a comprehensive analysis about: "${query}"
        
        Based on these search results: ${JSON.stringify(searchResults)}

        Important: Return a SINGLE-LINE JSON string with this structure:
        {
          "summary": {
            "overview": "Start with a comprehensive overview paragraph that introduces the topic and its significance",
            "currentState": "Provide a detailed paragraph about the current state of development, key players, and recent breakthroughs",
            "impact": "Explain the broader impact and implications in a well-structured paragraph",
            "futureOutlook": "Conclude with forward-looking insights and future developments in the field",
            "keyTakeaways": [
              "3-4 bullet points highlighting the most important takeaways",
              "Each point should be concise but informative"
            ]
          },
          "findings": [
            {
              "title": "Key Finding or Topic Area",
              "content": "Detailed explanation with specific facts, figures, and expert insights. Include real data points, research findings, and concrete examples",
              "source": "URL of authoritative source",
              "relevance": "High/Medium/Low",
              "credibility": 0.9,
              "type": "text",
              "category": "Choose relevant category (e.g., Technology, Research, Market Analysis, Scientific Finding, etc.)"
            }
          ],
          "keyInsights": [
            {
              "point": "Significant insight or trend",
              "explanation": "Detailed analysis of importance and implications",
              "supportingEvidence": [
                "Include specific data points",
                "Reference expert opinions",
                "Add relevant statistics",
                "Cite research findings"
              ]
            }
          ],
          "statistics": [
            {
              "value": "Specific numerical data",
              "metric": "What this number measures",
              "context": "Why this statistic is important",
              "source": "Source of the data"
            }
          ],
          "suggestedQuestions": [
            // Include 4-5 specific follow-up questions that would help explore:
            // - Deeper technical aspects
            // - Comparative analysis
            // - Future implications
            // - Practical applications
            // - Related developments
            // Make questions natural and contextual to the research
          ],
          "metadata": {
            "sourcesCount": Number of unique sources used,
            "confidence": Confidence score between 0 and 1,
            "researchDepth": "comprehensive",
            "lastUpdated": "${new Date().toISOString()}"
          }
        }

        Guidelines:
        1. Focus on factual, verifiable information
        2. Include diverse perspectives and sources
        3. Provide specific examples and case studies
        4. Add relevant statistics and data points
        5. Cite authoritative sources
        6. Cover recent developments and future implications
        7. Maintain objectivity in analysis`
      );

      // Clean and parse the response
      let cleanedResponse = response.content as string;
      
      // Remove any markdown code blocks
      if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse.replace(/```json\n|```/g, '');
      }

      // Sanitize the JSON string
      cleanedResponse = sanitizeJsonString(cleanedResponse);

      try {
        // Parse the cleaned response
        const research = JSON.parse(cleanedResponse);

        // Add relevant images
        if (imageSearchResults && Array.isArray(imageSearchResults)) {
          const relevantImages = imageSearchResults
            .filter(item => 
              item.url && 
              (item.url.match(/\.(jpg|jpeg|png|gif)$/i) || 
               item.url.includes('images') ||
               item.url.includes('media'))
            )
            .slice(0, 5)
            .map(item => ({
              type: "image",
              url: item.url,
              caption: sanitizeJsonString(item.title || "Related visual content"),
              source: item.source || item.url
            }));

          research.visualData = research.visualData || [];
          research.visualData.push(...relevantImages);
        }

        // Update API usage
        await supabase
          .from('api_keys')
          .update({ 
            usage: (keyData.usage || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', keyData.id);

        // Then in the sanitization, combine the summary sections
        if (research.summary && typeof research.summary === 'object') {
          research.summary = [
            research.summary.overview,
            research.summary.currentState,
            research.summary.impact,
            research.summary.futureOutlook,
            '',
            'Key Takeaways:',
            ...research.summary.keyTakeaways.map((point: string) => `• ${point}`)
          ].join('\n\n');
        }

        return NextResponse.json({ research });

      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.log('Raw Response:', cleanedResponse);
        
        // Return a more structured error response
        return NextResponse.json({
          message: 'Failed to parse research results',
          error: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          rawResponse: cleanedResponse.slice(0, 200) + '...' // First 200 chars for debugging
        }, { status: 500 });
      }
    } catch (error) {
      console.error('Research error:', error);
      return NextResponse.json(
        { message: 'Research failed', error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }
} 