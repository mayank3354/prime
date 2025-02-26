'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  Search, Calendar, FileText, Trash2, ExternalLink, 
  ChevronRight, BookOpen, Code, BarChart2, HelpCircle
} from 'lucide-react';

interface ResearchReport {
  id: string;
  query: string;
  summary: string;
  findings: Array<{
    title?: string;
    content: string;
    source: string;
    relevance: string;
    credibility: number;
  }>;
  key_insights: Array<{
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
  metadata: {
    sourcesCount: number;
    confidence: number;
    researchDepth: string;
  };
  created_at: string;
  code_examples?: Array<{
    title: string;
    language: string;
    code: string;
    description: string;
    source?: string;
  }>;
  suggested_questions?: Array<string>;
}

export default function ResearchReportsPage() {
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ResearchReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'findings' | 'statistics' | 'code' | 'questions'>('summary');
  const supabase = createClientComponentClient();
  
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      const { data, error } = await supabase
        .from('research_reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching reports:', error);
        toast.error('Failed to fetch research reports');
      } else {
        setReports(data || []);
        if (data && data.length > 0) {
          setSelectedReport(data[0]);
        }
      }
      setLoading(false);
    }
    
    fetchReports();
  }, [supabase]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeleteReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to delete reports');
        return;
      }

      const confirmed = window.confirm('Are you sure you want to delete this report? This action cannot be undone.');
      if (!confirmed) return;

      const { error } = await supabase
        .from('research_reports')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      setReports(prevReports => prevReports.filter(report => report.id !== id));
      if (selectedReport?.id === id) {
        setSelectedReport(reports.find(r => r.id !== id) || null);
      }
      
      toast.success('Report deleted successfully');
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  };

  // Format statistics data for charts
  const formatChartData = (statistics: Array<{
    value: string;
    metric: string;
    context: string;
    source?: string;
  }> | undefined) => {
    if (!statistics || !Array.isArray(statistics) || statistics.length === 0) {
      return [];
    }
    
    return statistics.map((stat, index) => ({
      name: stat.metric || `Stat ${index + 1}`,
      value: parseFloat(stat.value?.replace(/[^0-9.-]+/g, '')) || index + 1,
      rawValue: stat.value,
      description: stat.context
    }));
  };

  // Filter reports based on search term
  const filteredReports = reports.filter(report => 
    report.query.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // // Get section counts for the selected report
  // const getSectionCounts = (report: ResearchReport) => {
  //   return {
  //     findings: report.findings?.length || 0,
  //     statistics: report.statistics?.length || 0,
  //     code: report.code_examples?.length || 0,
  //     questions: report.suggested_questions?.length || 0
  //   };
  // };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <h1 className="text-3xl font-bold">Research Reports</h1>
        <div className="mt-4 md:mt-0 relative">
          <input
            type="text"
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 w-full md:w-64"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Research Reports Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Save research from the Research Assistant to view them here.
          </p>
          <a 
            href="/dashboard/assistant"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Research Assistant
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Reports List - Redesigned */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold">Saved Reports</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}
                </p>
              </div>
              
              <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[70vh] overflow-y-auto">
                {filteredReports.map((report) => (
                  <div 
                    key={report.id}
                    onClick={() => {
                      setSelectedReport(report);
                      setActiveTab('summary');
                    }}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedReport?.id === report.id 
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1 pr-6">
                        {report.query.length > 60 
                          ? report.query.substring(0, 60) + '...' 
                          : report.query
                        }
                      </h3>
                      <button 
                        onClick={(e) => handleDeleteReport(report.id, e)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete report"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{formatDate(report.created_at)}</span>
                      <span className="mx-2">•</span>
                      <span>{formatTime(report.created_at)}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-3">
                      {report.findings && report.findings.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {report.findings.length} findings
                        </span>
                      )}
                      {report.statistics && report.statistics.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {report.statistics.length} statistics
                        </span>
                      )}
                      {report.code_examples && report.code_examples.length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          {report.code_examples.length} code examples
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Report Details - Redesigned with Tabs */}
          <div className="lg:col-span-8 xl:col-span-9">
            {selectedReport ? (
              <div className="space-y-6">
                {/* Report Header */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">{selectedReport.query}</h2>
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>{formatDate(selectedReport.created_at)} at {formatTime(selectedReport.created_at)}</span>
                    <span className="mx-2">•</span>
                    <span>{selectedReport.metadata.sourcesCount} sources</span>
                    <span className="mx-2">•</span>
                    <span>{selectedReport.metadata.researchDepth} research</span>
                  </div>
                  
                  {/* Navigation Tabs */}
                  <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex space-x-8 overflow-x-auto" aria-label="Tabs">
                      <button
                        onClick={() => setActiveTab('summary')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                          activeTab === 'summary'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        Summary
                      </button>
                      
                      {selectedReport.findings && selectedReport.findings.length > 0 && (
                        <button
                          onClick={() => setActiveTab('findings')}
                          className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                            activeTab === 'findings'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                          }`}
                        >
                          Findings ({selectedReport.findings.length})
                        </button>
                      )}
                      
                      {selectedReport.statistics && selectedReport.statistics.length > 0 && (
                        <button
                          onClick={() => setActiveTab('statistics')}
                          className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                            activeTab === 'statistics'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                          }`}
                        >
                          Statistics ({selectedReport.statistics.length})
                        </button>
                      )}
                      
                      {selectedReport.code_examples && selectedReport.code_examples.length > 0 && (
                        <button
                          onClick={() => setActiveTab('code')}
                          className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                            activeTab === 'code'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                          }`}
                        >
                          Code Examples ({selectedReport.code_examples.length})
                        </button>
                      )}
                      
                      {selectedReport.suggested_questions && selectedReport.suggested_questions.length > 0 && (
                        <button
                          onClick={() => setActiveTab('questions')}
                          className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                            activeTab === 'questions'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                          }`}
                        >
                          Follow-up Questions ({selectedReport.suggested_questions.length})
                        </button>
                      )}
                    </nav>
                  </div>
                </div>
                
                {/* Tab Content */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  {activeTab === 'summary' && (
                    <div className="prose dark:prose-invert max-w-none">
                      <h3 className="text-xl font-semibold mb-4 flex items-center">
                        <BookOpen className="h-5 w-5 mr-2 text-blue-500" />
                        Summary
                      </h3>
                      <p className="whitespace-pre-line">{selectedReport.summary}</p>
                      
                      {/* Key Insights if available */}
                      {selectedReport.key_insights && selectedReport.key_insights.length > 0 && (
                        <div className="mt-8">
                          <h4 className="text-lg font-semibold mb-4">Key Insights</h4>
                          <div className="space-y-4">
                            {selectedReport.key_insights.map((insight, index) => (
                              <div key={index} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                <h5 className="font-bold text-blue-600 dark:text-blue-400">{insight.point}</h5>
                                <p className="mt-2">{insight.explanation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'findings' && selectedReport.findings && (
                    <div>
                      <h3 className="text-xl font-semibold mb-4 flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-blue-500" />
                        Key Findings
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {selectedReport.findings.map((finding, index) => (
                          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                            {finding.title && (
                              <h4 className="font-bold mb-2 text-gray-900 dark:text-white">{finding.title}</h4>
                            )}
                            <p className="text-gray-700 dark:text-gray-300 mb-3">{finding.content}</p>
                            <div className="flex justify-between items-center">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                finding.relevance === 'High' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                  : finding.relevance === 'Medium'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {finding.relevance} Relevance
                              </span>
                              {finding.source && (
                                <a 
                                  href={finding.source}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-600 flex items-center text-sm"
                                >
                                  <span>Source</span>
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'statistics' && selectedReport.statistics && (
                    <div>
                      <h3 className="text-xl font-semibold mb-4 flex items-center">
                        <BarChart2 className="h-5 w-5 mr-2 text-blue-500" />
                        Statistics & Data
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          {selectedReport.statistics.map((stat, index) => (
                            <div key={index} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-r-lg hover:shadow-md transition-shadow">
                              <div className="font-bold text-lg text-gray-900 dark:text-white">
                                {stat.value} 
                                <span className="text-gray-500 dark:text-gray-400 text-sm ml-1">{stat.metric}</span>
                              </div>
                              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{stat.context}</p>
                              {stat.source && (
                                <a 
                                  href={stat.source.startsWith('http') ? stat.source : `https://www.google.com/search?q=${encodeURIComponent(stat.context)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-600 text-xs mt-2 flex items-center"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  <span>Source</span>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <div className="h-80 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <ResponsiveContainer width="100%" height="100%">
                            {selectedReport.statistics.length <= 3 ? (
                              <PieChart>
                                <Pie
                                  data={formatChartData(selectedReport.statistics)}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {formatChartData(selectedReport.statistics).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                              </PieChart>
                            ) : (
                              <BarChart
                                data={formatChartData(selectedReport.statistics)}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="value" fill="#8884d8">
                                  {formatChartData(selectedReport.statistics).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'code' && selectedReport.code_examples && (
                    <div>
                      <h3 className="text-xl font-semibold mb-4 flex items-center">
                        <Code className="h-5 w-5 mr-2 text-blue-500" />
                        Code Examples
                      </h3>
                      <div className="space-y-6">
                        {selectedReport.code_examples.map((example, index) => (
                          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                            <div className="bg-gray-100 dark:bg-gray-700 p-3 flex justify-between items-center">
                              <h4 className="font-bold text-gray-900 dark:text-white">{example.title}</h4>
                              <span className="text-sm px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                {example.language}
                              </span>
                            </div>
                            <SyntaxHighlighter 
                              language={example.language} 
                              style={tomorrow}
                              customStyle={{ margin: 0 }}
                              showLineNumbers={true}
                            >
                              {example.code}
                            </SyntaxHighlighter>
                            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                              <p className="text-gray-700 dark:text-gray-300">{example.description}</p>
                              {example.source && (
                                <a 
                                  href={example.source}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-600 flex items-center text-sm mt-3"
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  <span>View Source</span>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'questions' && selectedReport.suggested_questions && (
                    <div>
                      <h3 className="text-xl font-semibold mb-4 flex items-center">
                        <HelpCircle className="h-5 w-5 mr-2 text-blue-500" />
                        Suggested Follow-up Questions
                      </h3>
                      <div className="space-y-3">
                        {selectedReport.suggested_questions.map((question, index) => (
                          <a 
                            key={index}
                            href={`/dashboard/assistant?q=${encodeURIComponent(question)}`}
                            className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group"
                          >
                            <div className="flex-1">
                              <p className="text-gray-800 dark:text-gray-200">{question}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Report Selected</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Select a report from the list to view its details.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      <ToastContainer position="bottom-right" />
    </div>
  );
} 