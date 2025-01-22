'use client';
import { useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface AgentThought {
  type: 'thinking' | 'searching' | 'analyzing' | 'complete';
  content: string;
  timestamp: number;
}

interface ResearchReport {
  id?: string;
  query: string;
  summary: string;
  findings: Array<{
    title: string;
    content: string;
    source: string;
    relevance: string;
    credibility: string;
  }>;
  references: Array<{
    url: string;
    title: string;
    publishDate: string;
    credibilityScore: string;
  }>;
  createdAt?: string;
}

export default function ResearchAssistant() {
  const [apiKey, setApiKey] = useState('');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [research, setResearch] = useState<ResearchReport | null>(null);
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const addThought = (type: AgentThought['type'], content: string) => {
    setThoughts(prev => [...prev, { type, content, timestamp: Date.now() }]);
  };

  const handleValidateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey }),
      });

      if (response.ok) {
        toast.success('API Key validated successfully');
        setIsValidated(true);
      } else {
        const data = await response.json();
        toast.error(data.message || 'Invalid API key');
      }
    } catch {
      toast.error('Failed to validate API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResearch(null);
    setThoughts([]);

    // Initial thought
    addThought('thinking', 'Starting research on: ' + query);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (response.ok) {
        addThought('complete', 'Research completed successfully');
        setResearch(data.research);
        toast.success('Research completed successfully');
      } else {
        addThought('thinking', 'Error: ' + (data.message || 'Failed to complete research'));
        toast.error(data.message || 'Failed to complete research');
      }
    } catch {
      addThought('thinking', 'Error: Failed to complete research');
      toast.error('Failed to complete research');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!research) return;

    try {
      const response = await fetch('/api/research/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          query,
          summary: research.summary,
          findings: research.findings,
          references: research.references
        }),
      });

      if (response.ok) {
        toast.success('Research report saved successfully!');
        setShowSaveDialog(false);
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to save research report');
      }
    } catch  {
      toast.error('Error saving research report');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-8">
      <ToastContainer position="top-right" theme="colored" />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Research Assistant
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Get comprehensive research insights powered by AI
        </p>
      </div>
      
      {!isValidated ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-6">Validate API Key</h2>
          
          <form onSubmit={handleValidateKey} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Enter your API key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="prime_xxxxxxxxxxxxxx"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !apiKey.trim()}
              className="w-full px-4 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Validating...' : 'Validate Key'}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Research Query</h2>
            
            <form onSubmit={handleResearch} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What would you like to research?
                </label>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your research query..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[120px]"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="w-full px-4 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Researching...' : 'Start Research'}
              </button>
            </form>
          </div>

          {/* Agent Thoughts Panel */}
          {thoughts.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-6">Agent Thoughts</h2>
              <div className="space-y-4">
                {thoughts.map((thought,) => (
                  <div 
                    key={thought.timestamp}
                    className={`p-4 rounded-lg ${
                      thought.type === 'thinking' ? 'bg-blue-50 dark:bg-blue-900/20' :
                      thought.type === 'searching' ? 'bg-purple-50 dark:bg-purple-900/20' :
                      thought.type === 'analyzing' ? 'bg-green-50 dark:bg-green-900/20' :
                      'bg-gray-50 dark:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {thought.type === 'thinking' ? '🤔' :
                         thought.type === 'searching' ? '🔍' :
                         thought.type === 'analyzing' ? '📊' :
                         '✅'}
                      </span>
                      <p className="text-gray-700 dark:text-gray-300">{thought.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Research Results Panel */}
          {research && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-8">
              <h2 className="text-xl font-semibold mb-6">Research Results</h2>
              
              {/* Summary Section */}
              <div className="prose dark:prose-invert max-w-none">
                <div className="mb-8">
                  <h3 className="text-lg font-medium mb-3">Summary</h3>
                  <p className="text-gray-700 dark:text-gray-300">{research.summary}</p>
                </div>
                
                {/* Findings Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium mb-4">Key Findings</h3>
                  <div className="space-y-6">
                    {research.findings.map((finding, index) => (
                      <div 
                        key={index}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4"
                      >
                        <h4 className="font-medium mb-2">{finding.title}</h4>
                        <p className="text-gray-700 dark:text-gray-300 mb-2">
                          {finding.content}
                        </p>
                        {finding.source && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Source: {finding.source}
                          </div>
                        )}
                        <div className="flex gap-4 mt-2 text-sm">
                          {finding.relevance && (
                            <span className="text-blue-600 dark:text-blue-400">
                              Relevance: {finding.relevance}
                            </span>
                          )}
                          {finding.credibility && (
                            <span className="text-green-600 dark:text-green-400">
                              Credibility: {finding.credibility}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* References Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium mb-4">References</h3>
                  <div className="space-y-4">
                    {research.references.map((reference, index) => (
                      <div 
                        key={index}
                        className="border-l-4 border-gray-300 dark:border-gray-600 pl-4"
                      >
                        <a 
                          href={reference.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {reference.title}
                        </a>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {reference.publishDate && (
                            <span className="mr-4">
                              Published: {reference.publishDate}
                            </span>
                          )}
                          {reference.credibilityScore && (
                            <span>
                              Credibility Score: {reference.credibilityScore}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save Report Button */}
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                >
                  Save to Research Reports
                </button>
              </div>

              {/* Save Dialog */}
              {showSaveDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
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
                        onClick={handleSaveReport}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                      >
                        Save Report
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 