'use client';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'react-toastify';
import { Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";

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
  metadata: {
    sourcesCount: number;
    confidence: number;
  };
  created_at: string;
}

export default function ResearchReports() {
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ResearchReport | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Research Reports</h1>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No research reports found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={`p-4 rounded-lg cursor-pointer transition-colors ${
                  selectedReport?.id === report.id
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <h3 className="font-medium mb-2">{report.query}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(report.created_at)}
                </p>
              </div>
            ))}
          </div>

          <div className="md:col-span-2">
            {selectedReport && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">{selectedReport.query}</h2>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteReport(selectedReport.id)}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Report
                  </Button>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="mb-6">{selectedReport.summary}</p>
                  
                  <h3 className="text-lg font-semibold mb-4">Key Findings</h3>
                  <div className="space-y-4">
                    {selectedReport.findings.map((finding, index) => (
                      <div key={index} className="border dark:border-gray-700 rounded-lg p-4">
                        <p>{finding.content}</p>
                        <div className="mt-2 flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>Source: {finding.source}</span>
                          <span>Relevance: {finding.relevance}</span>
                          <span>Credibility: {Math.round(finding.credibility * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 