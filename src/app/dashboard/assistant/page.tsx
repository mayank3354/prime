'use client';
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ChartBarIcon, LinkIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { CheckCircle, SaveIcon, Loader, Globe, BookOpen, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    id: string;
    title: string;
    content: string;
    source: string;
    relevance: string;
    credibility: number;
    type: string;
    category: string;
    publishedDate?: string;
    authors: string[];
    tags: string[];
  }>;
  keyInsights: Array<{
    id: string;
    point: string;
    explanation: string;
    supportingEvidence: string[];
    confidence: number;
    category: string;
  }>;
  statistics?: Array<{
    id: string;
    value: string;
    metric: string;
    context: string;
    source: string;
    unit: string;
    trend: string;
    lastUpdated: string;
  }>;
  codeExamples?: Array<{
    id: string;
    title: string;
    language: string;
    code: string;
    description: string;
    source: string;
    complexity: string;
    tags: string[];
    lastUpdated: string;
  }>;
  suggestedQuestions: Array<{
    id: string;
    question: string;
    category: string;
    priority: number;
  }>;
  metadata: {
    sourcesCount: number;
    confidence: number;
    researchDepth: string;
    lastUpdated: string;
    researchType: string;
    searchQueries?: number;
    qualityScore?: number;
    processingTime?: number;
    errorCount?: number;
    error?: boolean;
    errorMessage?: string;
    completeness?: number;
    reliability?: number;
    freshness?: number;
    diversity?: number;
    avgCredibility?: number;
    topCategories?: string[];
    scope?: string;
  };
  qualityIndicators?: {
    completeness?: number;
    reliability?: number;
    freshness?: number;
    diversity?: number;
    avgCredibility?: number;
    topCategories?: string[];
    scope?: string;
  };
  researchSummary?: {
    enhancedSummary?: string;
  };
  visualData?: Array<{
    type: string;
    url: string;
    caption: string;
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

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onValidate: (key: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onValidate }) => {
  const [inputKey, setInputKey] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Enter API Key</h2>
        <input
          type="password"
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          placeholder="Your API Key"
          className="w-full px-3 py-2 border rounded-md mb-4 dark:bg-gray-700 dark:border-gray-600"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-md border dark:border-gray-600">Cancel</button>
          <button onClick={() => onValidate(inputKey)} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Validate</button>
        </div>
      </div>
    </div>
  );
};

interface ResearchResultViewProps {
  result: ResearchResult | Partial<ResearchResult> | null;
  query: string;
  onSave: (resultToSave: ResearchResult) => void;
  onFollowUp: (question: string) => void;
  currentStatus?: ResearchStatus | null;
  isInitialLoading?: boolean;
}

const ResearchResultView: React.FC<ResearchResultViewProps> = ({ 
  result, 
  query, 
  onSave, 
  onFollowUp, 
  currentStatus, 
  isInitialLoading 
}) => {
  console.log('🎨 ResearchResultView render:', {
    hasResult: !!result,
    hasCurrentStatus: !!currentStatus,
    isInitialLoading,
    query,
    resultKeys: result ? Object.keys(result) : [],
    statusStage: currentStatus?.stage,
    statusMessage: currentStatus?.message
  });

  if (!result && !currentStatus) {
    console.log('🎨 Showing initializing message');
    return <div className="text-center py-10">Initializing...</div>;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard!');
    }).catch(err => {
      toast.error('Failed to copy!');
      console.error('Failed to copy text: ', err);
    });
  };
  
  const { summary, findings, keyInsights, statistics, codeExamples, suggestedQuestions, metadata } = result || {};
  
  // Show streaming status for initial loading
  const displaySummaryText = isInitialLoading && currentStatus ? "" : (summary || "No summary available");
  const showStatusInSummary = isInitialLoading && currentStatus;

  const handleInternalSave = () => {
    if (result && 'summary' in result && 'findings' in result && 'keyInsights' in result && 'metadata' in result && 'suggestedQuestions' in result) {
      const completeResult = result as ResearchResult;
      onSave(completeResult);
    } else {
      toast.warn("Cannot save partial or incomplete result.");
    }
  };

  const renderStatistic = (stat: NonNullable<ResearchResult['statistics']>[number], index: number) => (
    <div key={stat?.id || index} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <h4 className="font-semibold text-blue-600 dark:text-blue-400">{stat?.metric || 'N/A'}</h4>
      <p className="text-2xl font-bold">{stat?.value || 'N/A'}</p>
      {stat?.context && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stat.context}</p>}
      {stat?.source && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Source: {stat.source}</p>}
    </div>
  );

  const renderCodeExample = (example: NonNullable<ResearchResult['codeExamples']>[number], index: number) => (
    <div key={example?.id || index} className="mb-6 p-4 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-lg">{example?.title || 'Code Example'} <Badge variant="secondary">{example?.language || 'code'}</Badge></h4>
        <button
          onClick={() => copyToClipboard(example?.code || '')}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="Copy code"
        >
          <ClipboardIcon className="w-5 h-5" />
        </button>
      </div>
      {example?.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{example.description}</p>}
      <SyntaxHighlighter language={example?.language || 'text'} style={tomorrow} customStyle={{ borderRadius: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
        {example?.code || '// No code available'}
      </SyntaxHighlighter>
      {example?.source && <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Source: {example.source}</p>}
    </div>
  );
  
  const chartData = statistics?.map(stat => ({
    name: stat.metric,
    value: parseFloat(stat.value) || 0 
  })).filter(item => !isNaN(item.value) && item.value > 0);

  const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82Ca9D'];

  return (
    <div className="space-y-8">
      {/* Research Summary Section */}
      <section>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 text-gray-900 dark:text-white">
            <div className="p-2 bg-blue-500 rounded-lg">
              <ChartBarIcon className="w-6 h-6 text-white" />
            </div>
            Research Summary
          </h2>
          
          {showStatusInSummary && (
            <div className="mb-4 p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-blue-200 dark:border-blue-700">
              <h3 className="font-semibold text-lg mb-2 text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <Loader className="w-5 h-5 animate-spin" />
                {currentStatus.stage.charAt(0).toUpperCase() + currentStatus.stage.slice(1)}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3">{currentStatus.message}</p>
              {currentStatus.progress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Progress</span>
                    <span>{currentStatus.progress.current} of {currentStatus.progress.total} steps</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${(currentStatus.progress.current / currentStatus.progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="prose dark:prose-invert max-w-none">
            <div className="text-lg leading-relaxed text-gray-800 dark:text-gray-200">
              {displaySummaryText || "Generating comprehensive research summary..."}
            </div>
          </div>
        </div>

        {/* Enhanced Metadata display */}
        {metadata && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {metadata.sourcesCount ?? 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Sources</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {metadata.confidence ? `${(metadata.confidence * 100).toFixed(0)}%` : 'N/A'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Confidence</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-sm font-bold text-purple-600 dark:text-purple-400 truncate">
                {metadata.researchDepth || 'N/A'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Depth</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                {metadata.lastUpdated ? new Date(metadata.lastUpdated).toLocaleDateString() : 'N/A'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Updated</div>
            </div>
          </div>
        )}
      </section>

      {/* Detailed Findings Section */}
      {(!isInitialLoading || (findings && findings.length > 0)) && findings && findings.length > 0 && (
        <section>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold flex items-center gap-3 text-gray-900 dark:text-white">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <LinkIcon className="w-5 h-5 text-white" />
                </div>
                Detailed Findings
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {findings.map((finding, index) => (
                <div key={finding?.id || index} className="group border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 hover:shadow-md transition-all duration-200">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {finding.title || 'Research Finding'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        (finding.credibility || 0) > 0.8 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : (finding.credibility || 0) > 0.6
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {((finding.credibility || 0) * 100).toFixed(0)}% credible
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                    {finding.content || 'Content not available'}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Source:</span>
                      <span className="text-blue-600 dark:text-blue-400 truncate max-w-xs">{finding.source || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Relevance:</span>
                      <span className="text-green-600 dark:text-green-400">{finding.relevance || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Key Insights Section */}
      {keyInsights && keyInsights.length > 0 && (
        <section>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold flex items-center gap-3 text-gray-900 dark:text-white">
                <div className="p-2 bg-green-500 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                Key Insights
              </h2>
            </div>
            <div className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                {keyInsights.map((insight, index) => (
                  <div key={insight?.id || index} className="group border border-gray-200 dark:border-gray-700 rounded-xl p-5 bg-gradient-to-br from-white to-green-50/30 dark:from-gray-800 dark:to-green-900/10 hover:shadow-lg transition-all duration-200">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-green-600 dark:text-green-400 font-bold text-sm">{index + 1}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors leading-tight">
                        {insight.point || 'Key Insight'}
                      </h3>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed ml-11">
                      {insight.explanation || 'Explanation not available'}
                    </p>
                    {insight.supportingEvidence && insight.supportingEvidence.length > 0 && (
                      <div className="mt-3 ml-11">
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Evidence:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {insight.supportingEvidence.map((evidence, i) => (
                            <span key={i} className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                              {evidence}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* Statistics & Visualizations */}
      {statistics && statistics.length > 0 && chartData && chartData.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Statistics Overview</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {statistics.slice(0, 4).map(renderStatistic)}
          </div>
          {chartData.length > 1 && (
            <div className="h-80 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {chartData.length > 0 && (
             <div className="h-80 bg-white dark:bg-gray-800 p-4 rounded-lg shadow mt-6">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={chartData}
                     cx="50%"
                     cy="50%"
                     labelLine={false}
                     outerRadius={100}
                     fill="#8884d8"
                     dataKey="value"
                     label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                   >
                     {chartData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip />
                   <Legend />
                 </PieChart>
               </ResponsiveContainer>
             </div>
          )}
        </section>
      )}

      {/* Code Examples */}
      {codeExamples && codeExamples.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
             Code Examples
          </h2>
          {codeExamples.map(renderCodeExample)}
        </section>
      )}

      {/* Suggested Questions Section */}
      {suggestedQuestions && suggestedQuestions.length > 0 && (
        <section>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold flex items-center gap-3 text-gray-900 dark:text-white">
                <div className="p-2 bg-yellow-500 rounded-lg">
                  <QuestionMarkCircleIcon className="w-5 h-5 text-white" />
                </div>
                Suggested Follow-up Questions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Click any question to explore deeper insights
              </p>
            </div>
            <div className="p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {suggestedQuestions.map((sq, index) => (
                  <button
                    key={sq?.id || index}
                    onClick={() => onFollowUp(sq.question)}
                    className="group p-4 text-left border border-gray-200 dark:border-gray-700 rounded-xl hover:border-yellow-300 dark:hover:border-yellow-600 hover:shadow-md transition-all duration-200 bg-gradient-to-r from-white to-yellow-50/30 dark:from-gray-800 dark:to-yellow-900/10"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0 mt-1 group-hover:bg-yellow-200 dark:group-hover:bg-yellow-800/50 transition-colors">
                        <span className="text-yellow-600 dark:text-yellow-400 font-bold text-xs">?</span>
                      </div>
                      <span className="text-gray-800 dark:text-gray-200 group-hover:text-yellow-700 dark:group-hover:text-yellow-300 transition-colors leading-relaxed">
                        {sq.question || 'Follow-up question'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* Save Button Section */}
      {!isInitialLoading && result && 'summary' in result && result.summary !== "Loading research..." && (
         <div className="mt-8">
           <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800 text-center">
             <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
               📚 Save this research for later
             </h3>
             <p className="text-gray-600 dark:text-gray-400 mb-4">
               Save this comprehensive research to your personal library for future reference
             </p>
             <button
               onClick={handleInternalSave}
               disabled={!result || !('summary' in result) || isInitialLoading}
               className="inline-flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
             >
               <SaveIcon className="w-6 h-6" /> 
               Save Research
             </button>
           </div>
         </div>
      )}
    </div>
  );
};

const ResearchAssistant = () => {
  console.log('🚀 ResearchAssistant component mounting/re-rendering');
  
  const [query, setQuery] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [searchMode, setSearchMode] = useState<'web' | 'academic'>('web');
  const [status, setStatus] = useState<ResearchStatus | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedResult, setStreamedResult] = useState<Partial<ResearchResult> | null>(null);

  const supabase = createClientComponentClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  // **NEW: Function to get user's API key**
  const getUserApiKey = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('No authenticated user found');
      }

      const { data: apiKeys, error } = await supabase
        .from('api_keys')
        .select('key')
        .eq('user_id', session.user.id)
        .limit(1)
        .single();

      if (error || !apiKeys) {
        console.error('Failed to get API key:', error);
        return null;
      }

      return apiKeys.key;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }, [supabase]);

  // **NEW: Load user's API key on component mount**
  useEffect(() => {
    const loadApiKey = async () => {
      const userApiKey = await getUserApiKey();
      if (userApiKey) {
        setApiKey(userApiKey);
        setIsValidated(true);
      } else {
        setShowApiKeyModal(true);
      }
    };

    loadApiKey();
  }, [getUserApiKey]);

  // Debug state changes
  useEffect(() => {
    console.log('🔄 isLoading changed:', isLoading);
  }, [isLoading]);

  useEffect(() => {
    console.log('🔄 isStreaming changed:', isStreaming);
  }, [isStreaming]);

  useEffect(() => {
    console.log('🔄 status changed:', status);
  }, [status]);

  useEffect(() => {
    console.log('🔄 streamedResult changed:', {
      hasResult: !!streamedResult,
      keys: streamedResult ? Object.keys(streamedResult) : [],
      summary: streamedResult?.summary?.substring(0, 50)
    });
  }, [streamedResult]);

  useEffect(() => {
    console.log('🔄 result changed:', {
      hasResult: !!result,
      keys: result ? Object.keys(result) : []
    });
  }, [result]);

  // Define placeholder before it's used in handleSearch
  const placeholderStreamingResult: Partial<ResearchResult> = useMemo(() => ({
    summary: "Loading research...",
    findings: [],
    keyInsights: [],
    suggestedQuestions: [],
    metadata: {
      sourcesCount: 0,
      confidence: 0,
      researchDepth: 'Initializing...',
      lastUpdated: new Date().toLocaleDateString(),
      researchType: 'web',
    }
  }), []);

  const handleSearch = useCallback(async (queryToSearch?: string) => {
    console.log('🔍🔍🔍 HANDLESEACH CALLED! 🔍🔍🔍', { queryToSearch, currentQuery: query });
    
    const effectiveQuery = queryToSearch || query;
    console.log('🔍 Effective query:', effectiveQuery);
    
    if (!effectiveQuery.trim()) {
      console.log('🔍 Empty query, showing alert');
      alert("Please enter a search query.");
      return;
    }
    
    // **UPDATED: Check for valid API key**
    if (!apiKey) {
      console.log('🔑 No API key available, getting fresh key...');
      const freshApiKey = await getUserApiKey();
      if (!freshApiKey) {
        console.log('🔑 Failed to get API key, showing modal');
        setShowApiKeyModal(true);
        return;
      }
      setApiKey(freshApiKey);
    }

    console.log('🔍 Starting search for:', effectiveQuery);
    setIsLoading(true);
    setResult(null);
    setStatus({ stage: 'searching', message: 'Initializing search...', progress: {current: 0, total: 5}});
    setIsStreaming(true);
    setStreamedResult(placeholderStreamingResult); // Set initial streaming result

    // Update URL reflect current search
    router.push(`/dashboard/assistant?q=${encodeURIComponent(effectiveQuery)}`, { scroll: false });

    try {
      console.log('📡 Making fetch request to /api/research');
      console.log('📡 Request details:', {
        url: '/api/research',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey ? `${apiKey.substring(0, 8)}...` : 'none' // Log partial key for debugging
        },
        body: JSON.stringify({ query: effectiveQuery, researchType: searchMode })
      });
      
      const fetchPromise = fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || '', // **NEW: Include API key in headers**
        },
        body: JSON.stringify({ query: effectiveQuery, researchType: searchMode }),
      });
      
      console.log('📡 Fetch promise created, waiting for response...');
      
      const response = await fetchPromise;
      
      console.log('📡 Response received!', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        type: response.type,
        redirected: response.redirected,
        url: response.url
      });
      
      console.log('📡 Response headers:', {
        contentType: response.headers.get('content-type'),
        transferEncoding: response.headers.get('transfer-encoding'),
        connection: response.headers.get('connection'),
        cacheControl: response.headers.get('cache-control'),
        allHeaders: [...response.headers.entries()]
      });
      
      if (!response.ok) {
        console.error('📡 Response not OK:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('📡 Error response text:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('📡 Response headers:', {
        contentType: response.headers.get('content-type'),
        transferEncoding: response.headers.get('transfer-encoding'),
        connection: response.headers.get('connection')
      });
      
      // Test if we can read the response at all
      console.log('📡 Testing response readability...');
      const responseClone = response.clone();
      
      try {
        console.log('📡 Attempting to read as text...');
        const textResponse = await responseClone.text();
        console.log('📡 Text response received:', {
          length: textResponse.length,
          preview: textResponse.substring(0, 300),
          hasNewlines: textResponse.includes('\n'),
          lineCount: textResponse.split('\n').length
        });
        
        // Try to parse as complete response
        if (textResponse.length > 0) {
          console.log('📡 Attempting to parse JSON lines...');
          const lines = textResponse.split('\n').filter(line => line.trim());
          console.log('📡 Found', lines.length, 'lines');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            console.log(`📡 Line ${i + 1}:`, line.substring(0, 100));
            
            try {
              const data = JSON.parse(line);
              console.log(`📡 Parsed line ${i + 1}:`, Object.keys(data));
              
              if (data.research) {
                console.log('📡 Found research data! Research completed successfully.');
                setResult(data.research);
                setStreamedResult(data.research);
                setIsLoading(false);
                setIsStreaming(false);
                console.log('✅ Research results loaded and displayed');
                return;
              }
            } catch (parseError) {
              console.log(`📡 Line ${i + 1} parse error:`, parseError instanceof Error ? parseError.message : String(parseError));
            }
          }
        }
      } catch (textError) {
        console.error('📡 Failed to read as text:', textError);
      }
      
      if (!response.body) {
        console.error('📡 Response body is null after text test');
        throw new Error('Response body is null - streaming not supported');
      }
      
      console.log('📡 Response body exists, creating reader...');
      const reader = response.body.getReader();
      console.log('📖 Reader created successfully');
      
      let receivedData = '';
      let done = false;
      let hasReceivedFinalResult = false;
      let chunkCount = 0;
      
      console.log('📖 Starting to read stream...');
      
      // Add a timeout for the first chunk to detect stalled streams
      const streamTimeout = setTimeout(() => {
        console.error('⏰ Stream timeout - no data received in 10 seconds');
        reader.releaseLock();
        setIsLoading(false);
        setIsStreaming(false);
        setStatus({ stage: 'timeout', message: 'Stream timed out' });
      }, 10000);
      
      try {
        while (!done) {
          console.log(`📖 About to read chunk ${chunkCount + 1}...`);
          
          let readResult;
          try {
            readResult = await reader.read();
            
            // Clear timeout once we start receiving data
            if (chunkCount === 0) {
              clearTimeout(streamTimeout);
              console.log('⏰ Stream timeout cleared - data received');
            }
            
            console.log(`📖 Read result:`, {
              done: readResult.done,
              hasValue: !!readResult.value,
              valueType: typeof readResult.value,
              size: readResult.value?.length || 0
            });
          } catch (readError) {
            console.error('❌ Error during reader.read():', readError);
            clearTimeout(streamTimeout);
            throw readError;
          }
          
          done = readResult.done;
          const value = readResult.value;
          chunkCount++;
          
          console.log(`📦 Chunk ${chunkCount} status:`, {
            done,
            hasValue: !!value,
            size: value?.length || 0,
            valuePreview: value ? Array.from(value.slice(0, 10)) : 'no value'
          });
          
          if (done) {
            console.log('📖 Stream marked as done, breaking loop');
            break;
          }
          
          if (!value || value.length === 0) {
            console.log('📖 No value in chunk, continuing...');
            continue;
          }
          
          let chunk;
          try {
            chunk = new TextDecoder().decode(value);
            console.log('📄 Decoded chunk:', {
              length: chunk.length,
              preview: chunk.substring(0, 200),
              endsWithNewline: chunk.endsWith('\n'),
              hasData: chunk.includes('{')
            });
          } catch (decodeError) {
            console.error('❌ Error decoding chunk:', decodeError);
            continue;
          }
          
          receivedData += chunk;
          console.log('📄 Total received data length:', receivedData.length);
          
          const lines = receivedData.split('\n');
          receivedData = lines.pop() || ''; 
          
          console.log(`📋 Processing ${lines.length} lines from chunk`);
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) {
              console.log(`📋 Line ${i + 1}: Empty line, skipping`);
              continue;
            }
            
            console.log(`🔍 Line ${i + 1}: Processing line (${line.length} chars):`, line.substring(0, 100) + (line.length > 100 ? '...' : ''));
            
            try {
              const data = JSON.parse(line);
              console.log('✅ Parsed JSON successfully:', {
                keys: Object.keys(data),
                hasStatus: !!data.status,
                hasResearch: !!data.research,
                hasTest: !!data.test,
                hasError: !!data.error
              });
              
              if (data.status) {
                console.log('🔄 Status update received:', data.status);
                setStatus(data.status);
                
                // Update streaming result with status
                setStreamedResult(prev => {
                  const baseResult = prev || placeholderStreamingResult;
                  const updated = {
                    ...baseResult,
                    metadata: {
                      ...baseResult.metadata,
                      researchDepth: data.status.message,
                      lastUpdated: new Date().toISOString()
                    }
                  } as Partial<ResearchResult>;
                  console.log('🔄 Updated streamedResult with status');
                  return updated;
                });
                
              } else if (data.test) {
                console.log('🧪 Received test response:', data.test, data.timestamp);
                
              } else if (data.research) {
                console.log('🎉 Received final research result with keys:', Object.keys(data.research));
                hasReceivedFinalResult = true;
                setResult(data.research);
                setStreamedResult(data.research);
                setIsLoading(false);
                setIsStreaming(false);
                console.log('🎉 All states updated with final result');
                
                // **NEW: Trigger a small delay and then signal that usage was updated**
                setTimeout(() => {
                  console.log('📊 API usage should have been updated, signaling refresh needed');
                  // Dispatch a custom event that the dashboard can listen to
                  window.dispatchEvent(new CustomEvent('apiUsageUpdated'));
                }, 1000);
                
              } else if (data.error) {
                console.log('❌ Received error:', data.error);
                const errorMessage = typeof data.error === 'string' ? data.error : (data.error.message || 'An error occurred during research.');
                console.error('❌ Error message:', errorMessage);
                setIsLoading(false);
                setIsStreaming(false);
                setResult(null); 
                setStatus({ stage: 'error', message: errorMessage });
                done = true;
                break; 
              } else {
                console.log('❓ Unknown data format:', Object.keys(data));
              }
            } catch (parseError) {
              console.error('❌ Error parsing JSON line:', parseError);
              console.error('❌ Problematic line content:', JSON.stringify(line));
              console.error('❌ Line length:', line.length);
            }
          }
        }
      } catch (streamError) {
        console.error('❌ Error reading stream:', streamError);
        console.error('❌ Stream error details:', {
          name: streamError instanceof Error ? streamError.name : 'Unknown',
          message: streamError instanceof Error ? streamError.message : String(streamError),
          stack: streamError instanceof Error ? streamError.stack : 'No stack trace'
        });
        clearTimeout(streamTimeout);
        throw streamError;
      } finally {
        clearTimeout(streamTimeout);
        try {
          reader.releaseLock();
          console.log('📖 Reader lock released successfully');
        } catch (releaseError) {
          console.error('❌ Error releasing reader lock:', releaseError);
        }
      }
      
      console.log('📖 Stream reading completed. Final stats:', {
        totalChunks: chunkCount,
        finalResultReceived: hasReceivedFinalResult,
        currentStreamingState: isStreaming,
        totalDataReceived: receivedData.length
      });
      
      // Handle case where stream ended without final result
      if (!hasReceivedFinalResult) {
         console.log('⚠️ Stream ended without final result');
         setIsStreaming(false);
         setIsLoading(false);
         setStatus({ stage: 'incomplete', message: 'Stream ended unexpectedly' });
      }

    } catch (error) {
      console.error('💥 Search error:', error);
      console.error('💥 Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      setIsLoading(false);
      setIsStreaming(false);
      setStatus({ stage: 'error', message: error instanceof Error ? error.message : "Failed to complete research."});
      alert(`Error: ${error instanceof Error ? error.message : 'An error occurred during research. Please try again.'}`);
    }
  }, [query, searchMode, router, placeholderStreamingResult, isStreaming, apiKey, getUserApiKey]);

  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery && urlQuery !== query) {
      setQuery(urlQuery); // Sync input field state
      handleSearch(urlQuery); // Perform search with the new query
    }
  }, [searchParams, query, handleSearch]);

  const handleValidateKey = async (inputKey: string) => {
    try {
      // **NEW: Validate key against database instead of localStorage**
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: inputKey }),
      });

      if (response.ok) {
        setApiKey(inputKey);
        setIsValidated(true);
        setShowApiKeyModal(false);
        toast.success('API Key validated!');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Invalid API key.');
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate API key');
    }
  };

  const handleFollowUpQuestion = (followUpQuery: string) => {
    setQuery(followUpQuery);
    handleSearch(followUpQuery);
  };

  const handleSave = async (researchToSave: ResearchResult) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to save research.");
        return;
      }

      // Use the API endpoint instead of direct database access
      const response = await fetch('/api/research/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query, // The original query that led to this result
          research: researchToSave, // Storing the whole result object
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save research');
      }

      toast.success('Research saved successfully!');
    } catch (error) {
      console.error('Error saving research:', error);
      toast.error('Failed to save research.');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <ApiKeyModal 
        isOpen={showApiKeyModal && !isValidated} 
        onClose={() => setShowApiKeyModal(false)} 
        onValidate={handleValidateKey} 
      />

      {!isValidated && !showApiKeyModal && (
         <div className="text-center py-20">
           <h1 className="text-3xl font-bold mb-6">Research Assistant</h1>
           <p className="mb-8 text-gray-600 dark:text-gray-400">Please validate your API key to begin.</p>
           <button 
             onClick={() => setShowApiKeyModal(true)}
             className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-lg"
           >
             Enter API Key
           </button>
         </div>
      )}
      
      {isValidated && (!result && !isLoading && !isStreaming) && (
         <div className="text-center py-12">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl mb-6 shadow-xl">
                <Search className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl font-bold mb-4 tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                AI Research Assistant
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
                Unlock comprehensive insights with AI-powered research
              </p>
              <p className="text-gray-500 dark:text-gray-500">
                Get detailed analysis, key findings, and actionable insights in seconds
              </p>
            </div>
            
                         <div className="mb-8">
               <Tabs value={searchMode} onValueChange={(value) => setSearchMode(value as 'web' | 'academic')}>
                 <TabsList className="grid grid-cols-2 gap-1 p-1 mx-auto w-full max-w-xs rounded-full bg-gray-200 dark:bg-gray-700">
                   <TabsTrigger
                     value="web"
                     currentValue={searchMode}
                     onClick={() => setSearchMode('web')}
                     className="flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm transition-all"
                   >
                     <Globe className="w-4 h-4" />
                     Web Search
                   </TabsTrigger>
                   <TabsTrigger
                     value="academic"
                     currentValue={searchMode}
                     onClick={() => setSearchMode('academic')}
                     className="flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm transition-all"
                   >
                     <BookOpen className="w-4 h-4" />
                     Academic Research
                   </TabsTrigger>
                 </TabsList>
               </Tabs>
             </div>
            
            <div className="relative mb-12">
              <form 
                onSubmit={(e) => {
                  e.preventDefault(); 
                  handleSearch(); // Will use 'query' state
                }} 
                className="relative"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-2xl blur-xl"></div>
                  <div className="relative flex items-center bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/20 transition-all duration-200 shadow-lg">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={
                        searchMode === 'web' 
                          ? "What would you like to research? e.g., future of renewable energy..." 
                          : "Enter your academic research topic, e.g., advancements in CRISPR technology..."
                      }
                      className="w-full px-6 py-5 text-lg bg-transparent border-0 focus:ring-0 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !query.trim()}
                      className="m-2 px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          <span>Researching...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-5 h-5" />
                          <span>Research</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
            
            {/* Example Queries */}
            <div className="mt-8">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">
                  🚀 Try these popular research topics
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
                  Click any topic to start your research journey
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { topic: "Latest developments in quantum computing", icon: "🔬", category: "Technology" },
                    { topic: "Top AI companies in healthcare", icon: "🏥", category: "Business" },
                    { topic: "Renewable energy trends 2024", icon: "🌱", category: "Environment" },
                    { topic: "Impact of social media on mental health", icon: "🧠", category: "Psychology" }
                  ].map((item, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setQuery(item.topic); // Update input field
                        handleSearch(item.topic); // Search with this suggestion
                      }}
                      className="group p-4 text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200 transform hover:scale-105"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                          {item.icon}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.topic}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">
                            {item.category}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar for subsequent searches (when results are shown or loading) */}
      {isValidated && (isLoading || result || isStreaming) && (
        <div className="mb-8 sticky top-0 z-10 bg-white dark:bg-gray-900 py-4 shadow-sm">
          <div className="relative max-w-2xl mx-auto">
            <form 
              onSubmit={(e) => {
                e.preventDefault(); 
                handleSearch(); // Will use 'query' state
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
                      ? "Enter new research query..." 
                      : "Search new academic papers..."
                  }
                  className="w-full px-4 py-3 rounded-lg border dark:border-gray-600 dark:bg-gray-700"
                />
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="absolute right-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {isLoading && !result ? ( // Show loader only if actively loading new results
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Research Results or Streaming View */}
      {isValidated && (result || isStreaming || streamedResult) && (
        <div className="mt-8" key={`research-${query}-${isLoading}-${isStreaming}`}>
          {(() => {
            console.log('🎨 Render decision:', {
              isValidated,
              hasResult: !!result,
              isStreaming,
              hasStreamedResult: !!streamedResult,
              showingStreamingView: isStreaming && !result,
              showingFinalResults: !!result
            });
            
            if (isStreaming && !result) {
              console.log('🎨 Rendering streaming view with:', {
                result: streamedResult || placeholderStreamingResult,
                currentStatus: status,
                isInitialLoading: true
              });
              
              const progressPercentage = status?.progress ? 
                Math.round((status.progress.current / status.progress.total) * 100) : 0;
              
              return (
                <div className="space-y-6">
                  {/* Enhanced Progress Card */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                          <Search className="w-6 h-6 text-white animate-spin" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-ping"></div>
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                          🧠 AI Research in Progress
                        </h2>
                        <p className="text-gray-600 dark:text-gray-300 text-lg">
                          Analyzing &quot;{query}&quot; across multiple sources...
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {progressPercentage}%
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Complete
                        </div>
                      </div>
                    </div>
                    
                    {/* Enhanced Progress Bar */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {status?.stage ? status.stage.charAt(0).toUpperCase() + status.stage.slice(1) : 'Processing'}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Step {status?.progress?.current || 0} of {status?.progress?.total || 5}
                        </span>
                      </div>
                      
                      <div className="relative">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out relative"
                            style={{ width: `${progressPercentage}%` }}
                          >
                            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full"></div>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 min-h-[20px]">
                        {status?.message || 'Initializing research...'}
                      </p>
                    </div>
                    
                    {/* Research Steps Indicator */}
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      {['Search', 'Process', 'Analyze', 'Extract', 'Compile'].map((step, index) => (
                        <div key={step} className={`flex items-center space-x-1 ${
                          index < (status?.progress?.current || 0) ? 'text-blue-600 dark:text-blue-400' : ''
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            index < (status?.progress?.current || 0) 
                              ? 'bg-blue-600 dark:bg-blue-400' 
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}></div>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Live Results Preview */}
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        Live Research Results
                      </h3>
                    </div>
                    <div className="p-6">
                      <ResearchResultView
                        key={`streaming-${Date.now()}`}
                        result={streamedResult || placeholderStreamingResult}
                        query={query}
                        onSave={handleSave}
                        onFollowUp={handleFollowUpQuestion}
                        currentStatus={status}
                        isInitialLoading={true}
                      />
                    </div>
                  </div>
                </div>
              );
            } else if (result) {
              console.log('🎨 Rendering final results view');
              return (
                <div className="space-y-6">
                  {/* Success Header */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                          ✅ Research Complete!
                        </h2>
                        <p className="text-gray-600 dark:text-gray-300">
                          Comprehensive analysis for &quot;{query}&quot; completed successfully
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          100%
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Complete
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Final Results */}
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="p-6">
                      <ResearchResultView
                        key={`final-${Date.now()}`}
                        result={result}
                        query={query}
                        onSave={handleSave}
                        onFollowUp={handleFollowUpQuestion}
                        isInitialLoading={false}
                      />
                    </div>
                  </div>
                </div>
              );
            } else {
              console.log('🎨 No view to render');
              return null;
            }
          })()}
        </div>
      )}

      {/* Additional status display if needed */}
      {status && isLoading && !result && status.stage !== 'complete' && (
        <div className="mt-6 p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-md">
          <div className="flex items-center gap-3">
            <Loader className="w-5 h-5 animate-spin text-blue-500" />
            <div>
              <p className="font-medium">{status.stage.charAt(0).toUpperCase() + status.stage.slice(1)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{status.message}</p>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="bottom-right" autoClose={3000} theme="colored" />
    </div>
  );
};

// Suspense wrapper to fix useSearchParams deployment error
const ResearchAssistantPage = () => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Research Assistant...</p>
        </div>
      </div>
    }>
      <ResearchAssistant />
    </Suspense>
  );
};

export default ResearchAssistantPage; 