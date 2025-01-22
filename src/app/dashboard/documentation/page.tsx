'use client';
import { useState } from 'react';

export default function Documentation() {
  const [activeTab, setActiveTab] = useState('getting-started');

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Documentation
      </h1>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <nav className="flex space-x-8" aria-label="Documentation">
          {[
            { id: 'getting-started', name: 'Getting Started' },
            { id: 'features', name: 'Features' },
            { id: 'pricing', name: 'Pricing' },
            { id: 'api', name: 'API Reference' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Sections */}
      <div className="prose dark:prose-invert max-w-none">
        {activeTab === 'getting-started' && (
          <div>
            <h2>Getting Started</h2>
            <p>Welcome to our AI-powered Research Assistant! Follow these steps to begin:</p>
            
            <h3>1. API Key Setup</h3>
            <ul>
              <li>Generate your API key from the settings page</li>
              <li>Keep your API key secure and never share it</li>
              <li>Use this key for all API requests</li>
            </ul>

            <h3>2. Making Your First Research Query</h3>
            <ul>
              <li>Navigate to the Research Assistant</li>
              <li>Enter your research topic</li>
              <li>Review the AI-generated findings</li>
              <li>Save important research for later reference</li>
            </ul>

            <h3>3. Best Practices</h3>
            <ul>
              <li>Be specific in your research queries</li>
              <li>Use relevant keywords</li>
              <li>Review and verify sources</li>
              <li>Save important findings</li>
            </ul>
          </div>
        )}

        {activeTab === 'features' && (
          <div>
            <h2>Features</h2>
            
            <h3>AI-Powered Research</h3>
            <ul>
              <li>Advanced natural language processing</li>
              <li>Real-time web searching</li>
              <li>Source credibility assessment</li>
              <li>Automated summarization</li>
            </ul>

            <h3>Research Management</h3>
            <ul>
              <li>Save and organize research findings</li>
              <li>Export reports in multiple formats</li>
              <li>Collaborative sharing options</li>
              <li>Version history tracking</li>
            </ul>

            <h3>Analysis Tools</h3>
            <ul>
              <li>Source verification</li>
              <li>Relevance scoring</li>
              <li>Citation management</li>
              <li>Data visualization</li>
            </ul>
          </div>
        )}

        {activeTab === 'pricing' && (
          <div>
            <h2>Pricing Plans</h2>
            
            <div className="grid md:grid-cols-3 gap-8 mt-8">
              {/* Basic Plan */}
              <div className="border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Basic</h3>
                <p className="text-3xl font-bold mb-4">$29<span className="text-sm font-normal">/month</span></p>
                <ul className="space-y-3">
                  <li>✓ 100 research queries/month</li>
                  <li>✓ Basic AI analysis</li>
                  <li>✓ 5 saved reports</li>
                  <li>✓ Email support</li>
                </ul>
              </div>

              {/* Pro Plan */}
              <div className="border rounded-lg p-6 bg-blue-50 dark:bg-blue-900/20">
                <h3 className="text-xl font-semibold mb-4">Professional</h3>
                <p className="text-3xl font-bold mb-4">$99<span className="text-sm font-normal">/month</span></p>
                <ul className="space-y-3">
                  <li>✓ Unlimited queries</li>
                  <li>✓ Advanced AI analysis</li>
                  <li>✓ Unlimited saved reports</li>
                  <li>✓ Priority support</li>
                  <li>✓ Custom integrations</li>
                </ul>
              </div>

              {/* Enterprise Plan */}
              <div className="border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Enterprise</h3>
                <p className="text-3xl font-bold mb-4">Custom</p>
                <ul className="space-y-3">
                  <li>✓ All Pro features</li>
                  <li>✓ Custom AI models</li>
                  <li>✓ Dedicated support</li>
                  <li>✓ SLA guarantee</li>
                  <li>✓ On-premise options</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div>
            <h2>API Reference</h2>
            
            <h3>Authentication</h3>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <code>
                {`// Include your API key in the headers
fetch('/api/research', {
  headers: {
    'x-api-key': 'your-api-key'
  }
})`}
              </code>
            </pre>

            <h3>Endpoints</h3>
            <div className="space-y-6">
              <div>
                <h4>POST /api/research</h4>
                <p>Submit a research query</p>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                  <code>
                    {`{
  "query": "Your research topic",
  "options": {
    "depth": "detailed",
    "sources": ["academic", "news"]
  }
}`}
                  </code>
                </pre>
              </div>

              <div>
                <h4>GET /api/research/:id</h4>
                <p>Retrieve research results</p>
              </div>

              <div>
                <h4>POST /api/research/save</h4>
                <p>Save research findings</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 