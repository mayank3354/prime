'use client';
import { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { PlusIcon, MagnifyingGlassIcon, ChartBarIcon, LinkIcon, QuestionMarkCircleIcon} from '@heroicons/react/24/outline';
//import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Book, CheckCircle, ExternalLink, SaveIcon, Clock, Loader, Globe, BookOpen, Code } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
// import Link from 'next/link';
// import { Button } from "@/components/ui/button";
//import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { debounce } from 'lodash';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ClipboardIcon } from '@heroicons/react/24/outline';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useRouter, useSearchParams } from 'next/navigation';

interface ResearchResult {
  summary: string;
  findings: Array<{
    title: string;
    content: string;
    source: string;
    relevance: string;
    credibility: number;
    type: string;
    category: string;
  }>;
  suggestedQuestions: string[];
  metadata: {
    sourcesCount: number;
    confidence: number;
    researchDepth: string;
    lastUpdated: string;
  };
  visualData?: Array<{
    type: string;
    url: string;
    caption: string;
    source: string;
  }>;
  keyInsights: Array<{
    point: string;
    explanation: string;
    supportingEvidence: string[];
  }>;
  statistics?: Array<{
    value: string;
    metric: string;
    context: string;
    source: string;
  }>;
  codeExamples?: Array<{
    title: string;
    language: string;
    code: string;
    description: string;
    source: string;
  }>;
}

interface ResearchStatus {
  stage: string;
  message: string;
  progress?: {
    current: number;
    total: number;
  };
}

interface CodeExample {
  title: string;
  language: 'python' | 'javascript' | 'typescript' | string;
  code: string;
  description: string;
  source: string;
}

interface ResearchResultViewProps {
  result: ResearchResult | null;
  query: string;
  onSave: () => void;
  onFollowUp: (question: string) => void;
}

const ResearchResultView = ({ result, query, onSave, onFollowUp }: ResearchResultViewProps) => {
  const [isSaving, setIsSaving] = useState(false);

  if (!result) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">No results available</p>
      </div>
    );
  }

  const findings = result.findings || [];
 // const hasCodeExamples = result.codeExamples && result.codeExamples.length > 0;
  
  // Add colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  
  // Format statistics data for charts if available
  const chartData = result.statistics?.map((stat, index) => ({
    name: stat.metric,
    value: parseFloat(stat.value) || index + 1, // Try to parse as number, fallback to index
    description: stat.context,
    source: stat.source
  }));

  return (
    <div className="space-y-8">
      {/* Summary Section - Make it more prominent */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-100 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-6">Understanding: {query}</h2>
        <div className="prose dark:prose-invert max-w-none">
          {result.summary.split('\n\n').map((paragraph, i) => (
            paragraph.trim() ? (
              <p key={i} className="mb-4">
                <FormattedText text={paragraph} />
              </p>
            ) : null
          ))}
        </div>
      </div>
      
      {/* Key Insights - Display as steps if possible */}
      {result.keyInsights && result.keyInsights.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-100 dark:border-gray-700">
          <h3 className="text-xl font-semibold mb-6">Key Steps & Insights</h3>
          <div className="space-y-6">
            {result.keyInsights.map((insight, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">
                  {index + 1}
                </div>
                <div>
                  <h4 className="font-medium text-lg mb-2">{insight.point}</h4>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">{insight.explanation}</p>
                  {insight.supportingEvidence && insight.supportingEvidence.length > 0 && (
                    <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-300">
                      {insight.supportingEvidence.map((evidence, i) => (
                        <li key={i}>{evidence}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Findings Grid */}
      {findings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {findings.map((finding, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold mb-4">{finding.title || 'Untitled Finding'}</h3>
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-700 dark:text-gray-300">{finding.content || 'No content available'}</p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant={
                  finding.relevance === 'High' ? 'success' : 
                  finding.relevance === 'Medium' ? 'warning' : 'default'
                }>
                  {finding.relevance} Relevance
                </Badge>
                {finding.source && (
                  <a 
                    href={finding.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <span>Source</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistics Section */}
      {result.statistics && result.statistics.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <ChartBarIcon className="h-6 w-6 mr-2 text-blue-500" />
            Statistics & Data
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Statistics List */}
            <div className="space-y-4">
              {result.statistics.map((stat, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="font-bold text-lg">{stat.value} <span className="text-gray-500 text-sm">{stat.metric}</span></div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{stat.context}</p>
                  {stat.source && (
                    <div className="text-xs text-gray-500 mt-1 flex items-center">
                      <LinkIcon className="h-3 w-3 mr-1" />
                      Source: {stat.source}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Charts */}
            <div className="h-80 flex items-center justify-center">
              {chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartData.length <= 3 ? (
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, name]} />
                      <Legend />
                    </PieChart>
                  ) : (
                    <BarChart
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#8884d8" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="text-gray-500 text-center">
                  Not enough numerical data for visualization
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Questions */}
      {result.suggestedQuestions && result.suggestedQuestions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-100 dark:border-gray-700">
          <h3 className="text-xl font-semibold mb-6">Suggested Follow-up Questions</h3>
          <div className="space-y-4">
            {result.suggestedQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => onFollowUp(question)}
                className="w-full text-left p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3"
              >
                <QuestionMarkCircleIcon className="h-5 w-5 text-blue-500" />
                <span>{question}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => {
            setIsSaving(true);
            onSave();
            setTimeout(() => setIsSaving(false), 1000);
          }}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader className="h-5 w-5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <SaveIcon className="h-5 w-5" />
              <span>Save Research</span>
            </>
          )}
        </button>
      </div>

      {/* Code Examples */}
      {result.codeExamples && result.codeExamples.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-100 dark:border-gray-700">
          <h3 className="text-xl font-semibold mb-6">Code Examples</h3>
          <div className="space-y-6">
            {result.codeExamples.map((example, index) => (
              <CodeExampleView key={index} example={example} />
            ))}
          </div>
        </div>
      )}

      <ToastContainer position="bottom-right" />
    </div>
  );
};

const CodeExampleView = ({ example }: { example: CodeExample }) => {
  const [copied, setCopied] = useState(false);
  
  if (!example) {
    return <div className="p-4 border rounded-md">No code example available</div>;
  }
  
  const handleCopy = () => {
    navigator.clipboard.writeText(example.code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Process code to handle markdown-style code blocks
  const processCode = (code: string = '') => {
    if (!code) return '';
    
    // If the code contains markdown-style code blocks, extract just the code
    if (code.includes('```')) {
      const codeBlockMatch = code.match(/```(?:(\w+))?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        // If we found a language in the code block, update the example language
        if (codeBlockMatch[1] && !example.language) {
          example.language = codeBlockMatch[1];
        }
        return codeBlockMatch[2].trim();
      }
    }
    return code;
  };
  
  const processedCode = processCode(example.code);
  const language = example.language || 'text';
  
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {example.title && (
        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-sm">{example.title}</h4>
        </div>
      )}
      
      <div className="relative">
        <SyntaxHighlighter 
          language={language} 
          style={tomorrow}
          customStyle={{
            margin: 0,
            padding: '1rem',
            maxHeight: '24rem',
            fontSize: '0.875rem',
            backgroundColor: '#f8f9fa', // Light mode background
            borderRadius: 0
          }}
          codeTagProps={{
            style: {
              fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
            }
          }}
        >
          {processedCode}
        </SyntaxHighlighter>
        
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 rounded-md shadow-sm border border-gray-200 dark:border-gray-700"
          aria-label="Copy code"
        >
          {copied ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <ClipboardIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          )}
        </button>
      </div>
      
      {example.description && (
        <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700">
          {example.description}
        </div>
      )}
    </div>
  );
};

// Add this new component for YouTube recommendations
const YouTubeRecommendations = ({ query }: { query: string }) => {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchVideos = async () => {
      if (!query) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        setVideos(data.items || []);
      } catch (error) {
        console.error('Error fetching YouTube videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [query]);

  if (loading) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow">
        <h3 className="text-lg font-medium mb-4">Loading recommendations...</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow">
      <h3 className="text-lg font-medium mb-4">Related Videos</h3>
      <div className="space-y-4">
        {videos.slice(0, 5).map((video) => (
          <a 
            key={video.id.videoId} 
            href={`https://www.youtube.com/watch?v=${video.id.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors p-2"
          >
            <div className="flex gap-3">
              <img 
                src={video.snippet.thumbnails.default.url} 
                alt={video.snippet.title}
                className="w-24 h-18 object-cover rounded"
              />
              <div>
                <h4 className="font-medium text-sm line-clamp-2">{video.snippet.title}</h4>
                <p className="text-xs text-gray-500 mt-1">{video.snippet.channelTitle}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

// Add this component to render formatted text with code blocks
const FormattedText = ({ text }: { text: string }) => {
  // Split text by code blocks (both inline and block)
  const parts = [];
  let lastIndex = 0;
  
  // Find all code blocks with regex
  const codeBlockRegex = /```(?:\w+)?\s*([\s\S]*?)```|`([^`]+)`/g;
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    
    // Check if this is an inline code block (with single backticks) or a block code (with triple backticks)
    if (match[2]) {
      // Inline code
      parts.push({
        type: 'inlineCode',
        content: match[2]
      });
    } else {
      // Block code
      parts.push({
        type: 'blockCode',
        content: match[1],
        language: match[0].match(/```(\w+)/)?.[1] || 'text'
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.content}</span>;
        } else if (part.type === 'inlineCode') {
          return (
            <code 
              key={index}
              className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono text-sm"
            >
              {part.content}
            </code>
          );
        } else if (part.type === 'blockCode') {
          return (
            <div key={index} className="my-4">
              <SyntaxHighlighter 
                language={part.language} 
                style={tomorrow}
                customStyle={{
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem'
                }}
              >
                {part.content}
              </SyntaxHighlighter>
            </div>
          );
        }
        return null;
      })}
    </>
  );
};

export default function ResearchAssistant() {
  const [apiKey, setApiKey] = useState('');
  const [isValidated, setIsValidated] = useState(false);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchMode, setSearchMode] = useState<'web' | 'academic'>('web');
 // const [, setIsSaving] = useState(false);
  const [, setShowApiKeyModal] = useState(false);
  const [status, setStatus] = useState<ResearchStatus | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedResult, setStreamedResult] = useState<Partial<ResearchResult> | null>(null);
  const supabase = createClientComponentClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [useOllama, setUseOllama] = useState(false);

  // Debounced API key check
  const debouncedCheckApiKey = debounce(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsValidated(false);
        setShowApiKeyModal(true);
        return;
      }

      // Check if we already have a valid key
      const storedKey = localStorage.getItem('research_api_key');
      const isKeyValid = localStorage.getItem('research_api_key_valid');
      if (storedKey && isKeyValid === 'true') {
        setApiKey(storedKey);
        setIsValidated(true);
        return;
      }

      // Only fetch from Supabase if we don't have a valid key
      const { data: apiKeys, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', session.user.id)
        .limit(1)
        .single();

      if (error || !apiKeys) {
        setIsValidated(false);
        setShowApiKeyModal(true);
        return;
      }

      localStorage.setItem('research_api_key', apiKeys.key);
      localStorage.setItem('research_api_key_valid', 'true');
      setApiKey(apiKeys.key);
      setIsValidated(true);
    } catch (error) {
      console.error('Error checking API key:', error);
      setIsValidated(false);
      setShowApiKeyModal(true);
    }
  }, 1000); // 1 second delay

  useEffect(() => {
    debouncedCheckApiKey();
    return () => debouncedCheckApiKey.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleResize = () => {
      const sidebar = document.querySelector('[data-sidebar]');
      if (sidebar) {
        setIsSidebarCollapsed(sidebar.classList.contains('collapsed'));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    document.addEventListener('sidebarToggle', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('sidebarToggle', handleResize);
    };
  }, []);

  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery && urlQuery !== query) {
      setQuery(urlQuery);
      // Call handleSearch without parameters
      handleSearch();
    }
  }, [searchParams]); // React to URL changes

  const handleValidateKey = async (inputKey: string) => {
    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: inputKey }),
      });

      if (response.ok) {
        localStorage.setItem('research_api_key', inputKey);
        localStorage.setItem('research_api_key_valid', 'true');
        setApiKey(inputKey);
        setIsValidated(true);
        setShowApiKeyModal(false);
      } else {
        toast.error('Invalid API key');
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate API key');
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, useOllama }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is not readable');
      
      let receivedData = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Convert the chunk to text
        const chunk = new TextDecoder().decode(value);
        receivedData += chunk;
        
        // Process each line
        const lines = receivedData.split('\n');
        receivedData = lines.pop() || ''; // Keep the last incomplete line
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data = JSON.parse(line);
            
            if (data.status) {
              // Update status
              setStatus(data.status);
            } else if (data.research) {
              // Final research result
              setResult(data.research);
              setIsLoading(false);
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            console.error('Error parsing JSON:', e, line);
          }
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('An error occurred during research. Please try again.');
      setIsLoading(false);
    }
  };

  const handleFollowUpQuestion = (question: string) => {
    // Update URL without full page reload
    router.push(`/dashboard/assistant?q=${encodeURIComponent(question)}`);
    
    // Also update the query state and trigger search
    setQuery(question);
    handleSearch();
  };

  const handleSave = async () => {
    if (!result) {
      toast.error("No research results to save");
      return;
    }
    
    try {
      const response = await fetch('/api/research/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          research: result
        }),
      });
      
      if (!response.ok) throw new Error('Failed to save research');
      toast.success('Research saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save research');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 relative min-h-screen">
      {/* API Key Modal */}
      {!isValidated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Enter API Key</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleValidateKey(apiKey);
            }}>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key..."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 mb-4"
              />
              <button
                type="submit"
                disabled={isLoading || !apiKey.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Validating...' : 'Validate Key'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Centered Initial Search Bar */}
      {isValidated && !result && !isStreaming && (
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="w-full max-w-2xl">
            <h1 className="text-3xl font-bold text-center mb-8">Research Assistant</h1>
            <div className="mb-8">
              <Tabs value={searchMode} onValueChange={(value) => setSearchMode(value as 'web' | 'academic')}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger 
                    value="web" 
                    currentValue={searchMode}
                    onClick={() => setSearchMode('web')}
                    className="flex items-center gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    Web Search
                  </TabsTrigger>
                  <TabsTrigger 
                    value="academic" 
                    currentValue={searchMode}
                    onClick={() => setSearchMode('academic')}
                    className="flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    Academic Research
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="relative">
              <form 
                onSubmit={(e) => {
                  e.preventDefault(); // Prevent form submission
                  handleSearch();
                }} 
                className="relative"
              >
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      searchMode === 'web' 
                        ? "Enter your research query..." 
                        : "Search academic papers..."
                    }
                    className="w-full px-4 py-3 rounded-lg border dark:border-gray-600 dark:bg-gray-700"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !query.trim()}
                    className="absolute right-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>
            </div>
            
            {/* Example Queries */}
            <div className="mt-8">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">Try these example queries:</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {[
                  "Latest developments in quantum computing",
                  "Top AI companies in healthcare",
                  "Renewable energy trends 2024",
                  "Space exploration breakthroughs"
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setQuery(suggestion);
                      // Call handleSearch directly without parameters
                      handleSearch();
                    }}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Research Results */}
      {isValidated && (result || isStreaming) && (
        <div>
          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative">
              <form 
                onSubmit={(e) => {
                  e.preventDefault(); // Prevent form submission
                  handleSearch();
                }} 
                className="relative"
              >
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      searchMode === 'web' 
                        ? "Enter your research query..." 
                        : "Search academic papers..."
                    }
                    className="w-full px-4 py-3 rounded-lg border dark:border-gray-600 dark:bg-gray-700"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !query.trim()}
                    className="absolute right-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Results */}
          {isStreaming ? (
            <div className="animate-pulse">
              <ResearchResultView 
                result={streamedResult as ResearchResult} 
                query={query} 
                onSave={handleSave}
                onFollowUp={handleFollowUpQuestion}
              />
            </div>
          ) : (
            <ResearchResultView 
              result={result!} 
              query={query} 
              onSave={handleSave}
              onFollowUp={handleFollowUpQuestion}
            />
          )}
        </div>
      )}

      {/* Status Indicator */}
      {status && (
        <div className="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h3 className="font-medium">{status.stage.charAt(0).toUpperCase() + status.stage.slice(1)}</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400">{status.message}</p>
          {status.progress && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${(status.progress.current / status.progress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {status.progress.current} of {status.progress.total}
              </p>
            </div>
          )}
        </div>
      )}

      <ToastContainer position="bottom-right" />
    </div>
  );
} 