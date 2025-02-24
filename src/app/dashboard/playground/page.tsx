'use client';
import { useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface SummaryResponse {
  summary: string;
  cool_facts: string[];
}

export default function Playground() {
  const [apiKey, setApiKey] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

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

  const handleSummarize = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSummary(null);

    try {
      const response = await fetch('/api/github-summarizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        setSummary(data.summary);
        toast.success('Repository summarized successfully');
      } else {
        toast.error(data.message || 'Failed to summarize repository');
      }
    } catch {
      toast.error('Failed to summarize repository');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ToastContainer position="top-right" theme="colored" />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          GitHub Repository Summarizer
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Analyze and summarize GitHub repositories using AI
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
                className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !apiKey.trim()}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Validating...' : 'Validate Key'}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">Summarize Repository</h2>
            
            <form onSubmit={handleSummarize} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GitHub Repository URL
                </label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isLoading || !repoUrl.trim()}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Summarizing...' : 'Summarize Repository'}
              </button>
            </form>
          </div>

          {summary && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-6">Summary</h2>
              
              <div className="prose dark:prose-invert max-w-none">
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-2">Overview</h3>
                  <p className="text-gray-700 dark:text-gray-300">{summary.summary}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Cool Facts</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {summary.cool_facts.map((fact, index) => (
                      <li key={index} className="text-gray-700 dark:text-gray-300">{fact}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 