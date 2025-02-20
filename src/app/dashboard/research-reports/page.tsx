'use client';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'react-toastify';
import { Trash2, ChartBar, Clock, Search, Tag } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ResearchReport {
  id: string;
  query: string;
  summary: string;
  findings: Array<{
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
}

interface ResearchMetrics {
  totalReports: number;
  topCategories: Array<{ category: string; count: number }>;
  averageConfidence: number;
  searchesByDate: Array<{ date: string; count: number }>;
}

export default function ResearchReports() {
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [metrics, setMetrics] = useState<ResearchMetrics | null>(null);
  const [, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ResearchReport | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchReports();
    calculateMetrics();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReports = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to view reports');
        return;
      }

      const { data, error } = await supabase
        .from('research_reports')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to fetch research reports');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMetrics = () => {
    if (!reports.length) return;

    const metrics: ResearchMetrics = {
      totalReports: reports.length,
      topCategories: getTopCategories(),
      averageConfidence: getAverageConfidence(),
      searchesByDate: getSearchesByDate()
    };

    setMetrics(metrics);
  };

  const getTopCategories = () => {
    const categories = reports.flatMap(report => 
      report.findings.map(finding => finding.relevance)
    );
    const categoryCounts = categories.reduce((acc, category) => {
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => (b.count as number) - (a.count as number))
      .slice(0, 5);
  };

  const getAverageConfidence = () => {
    return reports.reduce((acc, report) => 
      acc + report.metadata.confidence, 0) / reports.length;
  };

  const getSearchesByDate = () => {
    const dateGroups = reports.reduce((acc, report) => {
      const date = new Date(report.created_at).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(dateGroups)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeleteReport = async (id: string) => {
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
        setSelectedReport(null);
      }
      
      toast.success('Report deleted successfully');
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Research Reports
      </h1>

      {/* Metrics Dashboard */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <Search className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Reports</p>
                <p className="text-2xl font-bold">{metrics.totalReports}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <ChartBar className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Avg. Confidence</p>
                <p className="text-2xl font-bold">{Math.round(metrics.averageConfidence * 100)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm col-span-2">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Top Categories</p>
            <div className="flex flex-wrap gap-2">
              {metrics.topCategories.map(({ category, count }) => (
                <Badge key={category} variant="secondary">
                  {category} ({count})
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Reports List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Recent Reports</h2>
          {reports.map((report) => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className={`p-4 rounded-xl cursor-pointer transition-all ${
                selectedReport?.id === report.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500'
                  : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
              } border`}
            >
              <h3 className="font-medium mb-2 line-clamp-2">{report.query}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span>{formatDate(report.created_at)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Report Details */}
        <div className="md:col-span-2">
          {selectedReport ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold">{selectedReport.query}</h2>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteReport(selectedReport.id)}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>

              {/* Summary */}
              <div className="prose dark:prose-invert max-w-none mb-8">
                <h3 className="text-lg font-semibold mb-2">Summary</h3>
                <p className="text-gray-600 dark:text-gray-300">{selectedReport.summary}</p>
              </div>

              {/* Statistics */}
              {selectedReport.statistics && selectedReport.statistics.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">Key Statistics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedReport.statistics.map((stat, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <p className="text-2xl font-bold mb-2">{stat.value}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{stat.metric}</p>
                        <p className="text-xs text-gray-500 mt-2">Source: {stat.source}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Insights */}
              {selectedReport.key_insights && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">Key Insights</h3>
                  <div className="space-y-4">
                    {selectedReport.key_insights.map((insight, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <p className="font-medium mb-2">{insight.point}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{insight.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Findings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Detailed Findings</h3>
                <div className="space-y-4">
                  {selectedReport.findings.map((finding, index) => (
                    <div key={index} className="border dark:border-gray-700 rounded-lg p-4">
                      <p className="mb-3">{finding.content}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Tag className="w-4 h-4" />
                          {finding.relevance}
                        </span>
                        <span>Credibility: {Math.round(finding.credibility * 100)}%</span>
                        <a href={finding.source} target="_blank" rel="noopener noreferrer" 
                           className="text-blue-500 hover:underline">
                          Source →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Select a report to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 