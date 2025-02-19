'use client';
import { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { PlusIcon, MagnifyingGlassIcon, ChartBarIcon, LinkIcon, QuestionMarkCircleIcon} from '@heroicons/react/24/outline';
//import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Book, CheckCircle, ExternalLink, SaveIcon, Clock, Loader } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
// import Link from 'next/link';
// import { Button } from "@/components/ui/button";
import Image from 'next/image';

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
}

// interface SaveResearchPayload {
//   query: string;
//   summary: string;
//   findings: Array<{
//     content: string;
//     source: string;
//     relevance: string;
//     credibility: number;
//   }>;
// }

const ResearchResultView = ({ result, query, onSave }: { result: ResearchResult; query: string; onSave: () => void }) => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Query Heading */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          {query}
          
        </h1>
        <div className="w-20 h-1 bg-blue-500 mx-auto rounded-full mb-8"></div>
      </div>

      {/* Summary Section with Enhanced Styling */}
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
            {result.findings.length} Companies Analyzed
          </Badge>
          <Badge variant="secondary" className="px-4 py-2">
            <CheckCircle className="h-4 w-4 mr-2" />
            {Math.round(result.metadata.confidence * 100)}% Confidence
          </Badge>
          <Badge variant="secondary" className="px-4 py-2">
            <Clock className="h-4 w-4 mr-2" />
            {result.metadata.researchDepth} Analysis
          </Badge>
        </div>
      </div>

      {/* Startup Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {result.findings.map((finding, index) => (
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
              <a 
                href={finding.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
              >
                <span>Source</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Visual Insights with Enhanced Layout */}
      {result.visualData && result.visualData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-100 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-6">Visual Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {result.visualData.map((visual, index) => (
              <div key={index} className="rounded-lg overflow-hidden">
                <Image 
                  src={visual.url} 
                  alt={visual.caption}
                  width={800}
                  height={600}
                  className="w-full h-64 object-cover rounded-lg"
                />
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  {visual.caption}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics Section */}
      {result.statistics && result.statistics.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-100 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <ChartBarIcon className="h-6 w-6 text-blue-500" />
            Key Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {result.statistics.map((stat, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">
                  {stat.metric}
                </div>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-300">
                  {stat.context}
                </p>
                {stat.source && (
                  <a 
                    href={stat.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1"
                  >
                    <LinkIcon className="h-4 w-4" />
                    Source
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Button - Now appears at the bottom of content */}
      <div className="flex justify-center py-8">
        <button
          onClick={onSave}
          className="bg-blue-600 text-white rounded-lg px-6 py-3 shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <SaveIcon className="h-5 w-5" />
          <span>Save Research</span>
        </button>
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
 // const [hasSearched, setHasSearched] = useState(false);
  const [, setIsSaving] = useState(false);
  const [, setShowApiKeyModal] = useState(false);

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
    const checkApiKey = () => {
      const storedKey = localStorage.getItem('research_api_key');
      const isKeyValid = localStorage.getItem('research_api_key_valid');
      
      if (!storedKey || isKeyValid !== 'true') {
        setIsValidated(false);
        setShowApiKeyModal(true);
      } else {
        setApiKey(storedKey);
        setIsValidated(true);
      }
    };

    checkApiKey();
  }, []);

  const handleValidateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('research_api_key', apiKey);
        localStorage.setItem('research_api_key_valid', 'true');
        setIsValidated(true);
        toast.success('API Key validated successfully');
      } else {
        toast.error(data.message);
        localStorage.removeItem('research_api_key');
        localStorage.removeItem('research_api_key_valid');
      }
    } catch {
      toast.error('Failed to validate API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localStorage.getItem('research_api_key') || '',
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Research failed');
      }

      if (!data.research) {
        throw new Error('Invalid research response');
      }

      setResult(data.research);
    } catch (error) {
      console.error('Search error:', error);
      toast.error(error instanceof Error ? error.message : 'Research failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowUp = (question: string) => {
    setQuery(question);
    handleSearch();
  };

  // const handleSaveResearch = async () => {
  //   if (!result) return;

  //   setIsSaving(true);
  //   try {
  //     // Get stored API key
  //     const apiKey = localStorage.getItem('research_api_key');
  //     if (!apiKey) {
  //       throw new Error('API key not found');
  //     }

  //     console.log('Saving research data:', {
  //       query,
  //       summary: result.summary,
  //       findings: result.findings,
  //       metadata: result.metadata
  //     });

  //     const response = await fetch('/api/research/save', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'x-api-key': apiKey
  //       },
  //       body: JSON.stringify({
  //         query,
  //         summary: result.summary,
  //         findings: result.findings,
  //         metadata: result.metadata
  //       })
  //     });

  //     if (!response.ok) {
  //       const error = await response.json();
  //       throw new Error(error.message || 'Failed to save research');
  //     }

  //     toast.success('Research saved successfully!');
  //   } catch (error) {
  //     console.error('Save error:', error);
  //     toast.error(error instanceof Error ? error.message : 'Failed to save research');
  //   } finally {
  //     setIsSaving(false);
  //   }
  // };

  return (
    <div className="container mx-auto px-4 py-8 relative min-h-screen">
      {/* API Key Modal */}
      {!isValidated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Enter API Key</h3>
            <form onSubmit={handleValidateKey}>
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
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What would you like to research?"
                className="w-full px-4 py-3 text-lg rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={isLoading || !query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>Researching...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <MagnifyingGlassIcon className="h-5 w-5" />
                    <span>Research</span>
                  </span>
                )}
              </button>
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

      {/* Results Section with Bottom Bar */}
      {result && (
        <>
          <div className="pb-40"> {/* Increased padding to accommodate bottom bar */}
            <ResearchResultView 
              result={result}
              query={query}
              onSave={() => setShowSaveDialog(true)} 
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
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    const response = await fetch('/api/research/save', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': localStorage.getItem('research_api_key') || '',
                      },
                      body: JSON.stringify({
                        query,
                        research: {
                          query,
                          summary: result?.summary,
                          findings: result?.findings,
                          keyInsights: result?.keyInsights,
                          statistics: result?.statistics,
                          metadata: result?.metadata
                        }
                      }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                      throw new Error(data.message || 'Failed to save research');
                    }

                    toast.success('Research saved successfully!');
                    setShowSaveDialog(false);
                  } catch (error) {
                    console.error('Save error:', error);
                    toast.error(error instanceof Error ? error.message : 'Failed to save research');
                  } finally {
                    setIsSaving(false);
                  }
                }}
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

      <ToastContainer position="bottom-right" />
    </div>
  );
} 