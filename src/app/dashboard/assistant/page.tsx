'use client';
import { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { PlusIcon, MagnifyingGlassIcon, KeyIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Book, CheckCircle, ExternalLink, SaveIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from "@/components/ui/button";

interface ResearchResult {
  summary: string;
  findings: Array<{
    content: string;
    source: string;
    relevance: string;
    credibility: number;
  }>;
  suggestedQuestions: string[];
  metadata: {
    sourcesCount: number;
    confidence: number;
  };
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

const ResearchResultView = ({ result, onSave }: { 
  result: ResearchResult; 
  onSave: () => void;
}) => {
  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Research Summary</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-300">{result.summary}</p>
        
        <div className="mt-4 flex gap-3">
          <Badge variant="secondary">
            <Book className="h-4 w-4 mr-1" />
            {result.findings.length} Sources
          </Badge>
          <Badge variant="secondary">
            <CheckCircle className="h-4 w-4 mr-1" />
            {Math.round(result.metadata.confidence * 100)}% Confidence
          </Badge>
        </div>
      </div>

      {/* Key Findings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Key Findings</h3>
        {result.findings.map((finding, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between">
              <div className="flex-1">
                <p className="text-gray-600 dark:text-gray-300">{finding.content}</p>
                <div className="mt-3 flex gap-2">
                  <Badge variant="outline">{finding.relevance}</Badge>
                  <Badge 
                    variant={finding.credibility > 0.7 ? "success" : "warning"}
                  >
                    {Math.round(finding.credibility * 100)}% Credible
                  </Badge>
                </div>
              </div>
              {finding.source && (
                <Link 
                  href={finding.source}
                  target="_blank"
                  className="ml-4 text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="h-5 w-5" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-6 border-t dark:border-gray-700">
        <Button
          onClick={onSave}
          className="flex items-center gap-2"
          variant="outline"
        >
          <SaveIcon className="h-4 w-4" />
          Save to Research Reports
        </Button>
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
  const [hasSearched, setHasSearched] = useState(false);
  const [, setIsSaving] = useState(false);

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

  // useEffect(() => {
  //   const checkApiKey = () => {
  //     const apiKey = localStorage.getItem('research_api_key');
  //     const isKeyValid = localStorage.getItem('research_api_key_valid');
      
  //     // Always show validation form if no valid key
  //     if (!apiKey || isKeyValid !== 'true') {
  //       setIsValidated(false);
  //       // Clear any invalid keys
  //       localStorage.removeItem('research_api_key');
  //       localStorage.removeItem('research_api_key_valid');
  //     } else {
  //       setIsValidated(true);
  //     }
  //   };

  //   checkApiKey();
  // }, []);

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
    
    // Check API key before search
    const apiKey = localStorage.getItem('research_api_key');
    const isKeyValid = localStorage.getItem('research_api_key_valid');
    
    if (!apiKey || isKeyValid !== 'true') {
      setIsValidated(false);
      toast.error('Please validate your API key first');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('Sending research query:', query);
      
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({ query })
      });

      const data = await response.json();
      console.log('Research API response:', data);

      if (!response.ok) {
        if (response.status === 401) {
          setIsValidated(false);
          localStorage.removeItem('research_api_key');
          localStorage.removeItem('research_api_key_valid');
          throw new Error('API key is invalid. Please validate again.');
        }
        throw new Error(data.message || 'Research failed');
      }

      setResult(data.research);
      setHasSearched(true);
      toast.success('Research completed successfully!');
    } catch (error) {
      console.error('Research error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to perform research');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowUp = (question: string) => {
    setQuery(question);
    handleSearch();
  };

  const handleSaveResearch = async () => {
    if (!result) return;

    setIsSaving(true);
    try {
      // Get stored API key
      const apiKey = localStorage.getItem('research_api_key');
      if (!apiKey) {
        throw new Error('API key not found');
      }

      console.log('Saving research data:', {
        query,
        summary: result.summary,
        findings: result.findings,
        metadata: result.metadata
      });

      const response = await fetch('/api/research/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          query,
          summary: result.summary,
          findings: result.findings,
          metadata: result.metadata
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save research');
      }

      toast.success('Research saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save research');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ToastContainer position="top-right" theme="colored" />
      
      <div className={`transition-all duration-300 ${
        isSidebarCollapsed ? 'ml-[4rem] sm:ml-20' : 'ml-[4rem] sm:ml-64'
      }`}>
        <AnimatePresence mode="wait">
          {!isValidated ? (
            <motion.div
              key="api-validation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-md mx-auto px-4 pt-16 sm:pt-32"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4 mx-auto">
                  <KeyIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-center mb-2">Enter API Key</h1>
                <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                  Please enter your API key to access the Research Assistant
                </p>
                <form onSubmit={handleValidateKey} className="space-y-4">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="w-full px-4 py-3 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !apiKey.trim()}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? 'Validating...' : 'Validate API Key'}
                  </button>
                </form>
              </div>
            </motion.div>
          ) : !hasSearched ? (
            <motion.div
              key="research-interface"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-5xl mx-auto px-4 py-4 sm:py-8"
            >
              <div className="mb-4 sm:mb-8 text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  Research Assistant
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Get comprehensive research insights powered by AI
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What would you like to research?"
                  className="w-full px-4 py-3 text-lg rounded-lg border-0 bg-transparent focus:ring-0 min-h-[120px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
                <div className="flex justify-center sm:justify-end mt-4">
                  <button
                    onClick={handleSearch}
                    disabled={isLoading || !query.trim()}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Researching...' : 'Research'}
                    <MagnifyingGlassIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="research-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-5xl mx-auto px-4 py-4 sm:py-8 mb-24"
            >
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <ResearchResultView 
                    result={result} 
                    onSave={handleSaveResearch}
                  />
                </motion.div>
              )}

              {result?.suggestedQuestions && result.suggestedQuestions.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-8">
                  <h2 className="text-xl font-semibold mb-4">Related Questions</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.suggestedQuestions.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleFollowUp(question)}
                        className="text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hasSearched && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className={`fixed bottom-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4 transition-all duration-300
                ${isSidebarCollapsed ? 'left-16 sm:left-20' : 'left-16 sm:left-64'}`}
            >
              <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  className="flex-1 px-4 py-3 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500"
                  onFocus={() => setQuery('')}
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading || !query.trim()}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 min-w-[140px]"
                >
                  <PlusIcon className="w-5 h-5" />
                  {isLoading ? 'Researching...' : 'Ask Follow-up'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showSaveDialog && (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Save Research Report</h3>
            <p className="mb-4">Do you want to save this research to your reports?</p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="text-gray-600 hover:text-gray-800 px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResearch}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                Save Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 