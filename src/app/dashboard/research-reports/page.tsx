'use client';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'react-toastify';

interface ResearchReport {
  id: string;
  query: string;
  summary: string;
  findings: Array<{
    title: string;
    content: string;
    source: string;
    relevance: string;
    credibility: string;
  }>;
  reference_list: Array<{
    url: string;
    title: string;
    publishDate: string;
    credibilityScore: string;
  }>;
  created_at: string;
}

export default function ResearchReports() {
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ResearchReport | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('research_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      toast.error('Failed to fetch research reports');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
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
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      const { error } = await supabase
        .from('research_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Report deleted successfully');
      setReports(reports.filter(report => report.id !== id));
      if (selectedReport?.id === id) {
        setSelectedReport(null);
      }
    } catch (error) {
      toast.error('Failed to delete report');
      console.error('Error:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Research Reports
      </h1>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No research reports found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Reports List */}
          <div className="lg:col-span-1 space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className={`p-4 rounded-lg cursor-pointer transition-colors ${
                  selectedReport?.id === report.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => setSelectedReport(report)}
              >
                <h3 className="font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                  {report.query}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {formatDate(report.created_at)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                  {report.summary}
                </p>
              </div>
            ))}
          </div>

          {/* Selected Report Detail */}
          <div className="lg:col-span-2">
            {selectedReport ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-8">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Research Details
                  </h2>
                  <button
                    onClick={() => handleDeleteReport(selectedReport.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Delete Report
                  </button>
                </div>

                <div className="prose dark:prose-invert max-w-none">
                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-2">Query</h3>
                    <p className="text-gray-700 dark:text-gray-300">{selectedReport.query}</p>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-2">Summary</h3>
                    <p className="text-gray-700 dark:text-gray-300">{selectedReport.summary}</p>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-4">Key Findings</h3>
                    <div className="space-y-4">
                      {selectedReport.findings.map((finding, index) => (
                        <div
                          key={index}
                          className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4"
                        >
                          <h4 className="font-medium mb-2">{finding.title}</h4>
                          <p className="text-gray-700 dark:text-gray-300 mb-2">
                            {finding.content}
                          </p>
                          <div className="flex gap-4 text-sm">
                            <span className="text-blue-600 dark:text-blue-400">
                              Relevance: {finding.relevance}
                            </span>
                            <span className="text-green-600 dark:text-green-400">
                              Credibility: {finding.credibility}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-4">References</h3>
                    <div className="space-y-4">
                      {selectedReport.reference_list.map((reference, index) => (
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
                            <span className="mr-4">
                              Published: {reference.publishDate}
                            </span>
                            <span>
                              Credibility Score: {reference.credibilityScore}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  Select a report to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 