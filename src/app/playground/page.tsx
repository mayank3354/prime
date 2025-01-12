'use client';
import { useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Playground() {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

      const data = await response.json();

      if (response.ok) {
        toast.success('Valid API Key - /protected can be accessed');
      } else {
        toast.error(data.message || 'Invalid API key');
      }
    } catch (error) {
      toast.error('Failed to validate API key');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <ToastContainer position="top-right" theme="colored" />
      
      <h1 className="text-3xl font-bold mb-8">API Playground</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-6">Validate API Key</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
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
    </div>
  );
} 