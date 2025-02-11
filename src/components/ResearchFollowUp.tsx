'use client';
import { useState } from 'react';
import { ResearchResult } from '../lib/agents/types';

interface ResearchFollowUpProps {
  initialResult: ResearchResult;
  onAskFollowUp: (question: string) => Promise<void>;
}

export function ResearchFollowUp({ initialResult, onAskFollowUp }: ResearchFollowUpProps) {
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAskQuestion = async (question: string) => {
    if (!question.trim()) return;
    
    setIsLoading(true);
    try {
      await onAskFollowUp(question);
    } finally {
      setIsLoading(false);
      setSelectedQuestion('');
      setCustomQuestion('');
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Suggested Follow-up Questions</h3>
        <div className="space-y-3">
          {initialResult.suggestedQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleAskQuestion(question)}
              disabled={isLoading}
              className={`w-full text-left px-4 py-2 rounded-lg border transition-colors
                ${selectedQuestion === question
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-500'
                }`}
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Ask Your Own Question</h3>
        <div className="flex gap-4">
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder="Type your follow-up question..."
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => handleAskQuestion(customQuestion)}
            disabled={isLoading || !customQuestion.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Asking...' : 'Ask'}
          </button>
        </div>
      </div>
    </div>
  );
} 