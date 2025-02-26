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
}

const ResearchResultView = ({ result, query, onSave }: ResearchResultViewProps) => {
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
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Query Heading */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          {query}
        </h1>
        <div className="w-20 h-1 bg-blue-500 mx-auto rounded-full mb-8"></div>
      </div>

      {/* Summary Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="h-6 w-6 text-blue-500" />
          <h2 className="text-2xl font-bold">Research Summary</h2>
        </div>
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {result.summary}
          </p>
        </div>
        
        <div className="mt-6 flex flex-wrap gap-4">
          <Badge variant="secondary" className="px-4 py-2">
            <Book className="h-4 w-4 mr-2" />
            {findings.length} Companies Analyzed
          </Badge>
          <Badge variant="secondary" className="px-4 py-2">
            <CheckCircle className="h-4 w-4 mr-2" />
            {Math.round((result.metadata?.confidence || 0) * 100)}% Confidence
          </Badge>
          <Badge variant="secondary" className="px-4 py-2">
            <Clock className="h-4 w-4 mr-2" />
            {result.metadata?.researchDepth || 'Basic'} Analysis
          </Badge>
        </div>
      </div>

      {/* Code Examples Section */}
      {result.codeExamples && result.codeExamples.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <Code className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-bold">Code Examples</h2>
          </div>
          <div className="space-y-6">
            {result.codeExamples.map((example, index) => (
              <CodeExampleView key={index} example={example} />
            ))}
          </div>
        </div>
      )}

      {/* Findings Grid */}
      {findings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {findings.map((finding, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold mb-4">{finding.title}</h3>
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-700 dark:text-gray-300">{finding.content}</p>
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
                onClick={() => window.location.href = `/dashboard/assistant?q=${encodeURIComponent(question)}`}
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

      <ToastContainer position="bottom-right" />
    </div>
  );
};

const CodeExampleView = ({ example }: { example: CodeExample }) => {
  return (
    <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      <div className="p-4">
        <h3 className="text-lg font-medium mb-2">{example.title}</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {example.description}
        </p>
      </div>

      <div className="relative">
        {/* Language Header */}
        <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 font-mono text-sm text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
          {example.language}
        </div>

        <div className="absolute right-2 top-2 z-10">
          <button
            onClick={() => navigator.clipboard.writeText(example.code)}
            className="p-2 bg-gray-800/10 hover:bg-gray-800/20 rounded-md transition-colors"
            title="Copy code"
          >
            <ClipboardIcon className="h-5 w-5" />
          </button>
        </div>

        <SyntaxHighlighter
          language={example.language.toLowerCase()}
          style={tomorrow}
          customStyle={{
            margin: 0,
            padding: '1.5rem',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            borderRadius: '0'
          }}
          showLineNumbers={true}
          wrapLines={true}
        >
          {example.code}
        </SyntaxHighlighter>
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-gray-700">
        <a 
          href={example.source}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
        >
          <LinkIcon className="h-4 w-4" />
          <span>View source</span>
        </a>
      </div>
    </div>
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
  const supabase = createClientComponentClient();

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setStatus(null);
    setResult(null);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          mode: searchMode
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response reader');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          const data = JSON.parse(line);
          if (data.status) {
            setStatus(data.status);
          }
          if (data.research) {
            setResult(data.research);
          }
          if (data.error) {
            throw new Error(data.error);
          }
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error(error instanceof Error ? error.message : 'Research failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowUp = (question: string) => {
    setQuery(question);
    handleSearch({ preventDefault: () => {} } as React.FormEvent);
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
      {isValidated && !result && (
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
              <form onSubmit={handleSearch} className="relative">
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
                      handleSearch({ preventDefault: () => {} } as React.FormEvent);
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

      {/* Results Section with Bottom Bar */}
      {result && (
        <>
          <div className="pb-40"> {/* Increased padding to accommodate bottom bar */}
            <ResearchResultView 
              result={result}
              query={query}
              onSave={handleSave} 
            />

            {/* Follow-up Questions Section */}
            {result.suggestedQuestions && result.suggestedQuestions.length > 0 && (
              <div className="max-w-4xl mx-auto mt-8 mb-16">
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Explore Further
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleFollowUp(question)}
                      className="text-left px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 group"
                    >
                      <PlusIcon className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform" />
                      <span className="text-gray-700 dark:text-gray-300">{question}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Floating Bottom Bar - Now just for the search */}
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg z-40">
            <div className={`mx-auto px-4 transition-all duration-200 ${
              isSidebarCollapsed ? 'max-w-7xl' : 'ml-64 mr-8'
            }`}>
              <div className="flex space-x-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a follow-up question..."
                    className="w-full px-4 py-3 pl-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                  />
                  <QuestionMarkCircleIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isLoading || !query.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 min-w-[140px] justify-center"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader className="h-5 w-5 animate-spin" />
                      <span>Thinking...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <MagnifyingGlassIcon className="h-5 w-5" />
                      <span>Ask Follow-up</span>
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Save Research</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              This research will be saved to your reports.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>Saving...</span>
                  </span>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add status display */}
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