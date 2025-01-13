'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ApiKey } from '@/types/api';
import { ApiKeyModal } from '@/components/ApiKeyModal';
import { ApiKeysTable } from '@/components/ApiKeysTable';
import { UsageStatsCard } from '@/components/UsageStatsCard';
import { useApiKeys } from '@/hooks/useApiKeys';

export default function Dashboard() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const {
    apiKeys,
    isLoading,
    visibleKeys,
    fetchApiKeys,
    createApiKey,
    updateApiKey,
    deleteApiKey,
    toggleKeyVisibility,
  } = useApiKeys();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
        return;
      }
      fetchApiKeys();
    };

    init();
  }, [router, supabase.auth, fetchApiKeys]);

  const handleCreateKey = async (data: { name: string; limit: number; monthlyLimit: boolean }) => {
    await createApiKey(data);
    setIsCreateModalOpen(false);
  };

  const handleEditKey = async (data: { name: string; limit: number; monthlyLimit: boolean }) => {
    if (!selectedKey) return;
    await updateApiKey(selectedKey.id, data);
    setIsEditModalOpen(false);
    setSelectedKey(null);
  };

  const handleDeleteKey = async () => {
    if (!selectedKey) return;
    await deleteApiKey(selectedKey.id);
    setIsDeleteModalOpen(false);
    setSelectedKey(null);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('API key copied to clipboard');
    } catch  {
      toast.error('Failed to copy API key');
    }
  };

  return (
    <div className="min-h-screen p-8 bg-white dark:bg-gray-900">
      <ToastContainer position="top-right" theme="colored" />
      
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
          <span>Pages</span>
          <span>/</span>
          <span>Overview</span>
        </div>
        
        <h1 className="text-3xl font-bold mb-8">Overview</h1>

        <UsageStatsCard apiKeys={apiKeys} />

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">API Keys</h2>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                disabled={isLoading}
                className="px-4 py-2 bg-black dark:bg-white dark:text-black text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Create API Key
              </button>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              The key is used to authenticate your requests to the Research API.
            </div>

            <ApiKeysTable
              apiKeys={apiKeys}
              visibleKeys={visibleKeys}
              onToggleVisibility={toggleKeyVisibility}
              onCopy={copyToClipboard}
              onEdit={(key) => {
                setSelectedKey(key);
                setIsEditModalOpen(true);
              }}
              onDelete={(key) => {
                setSelectedKey(key);
                setIsDeleteModalOpen(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this API key? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteKey}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      <ApiKeyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateKey}
        title="Create API key"
      />

      {/* Edit API Key Modal */}
      <ApiKeyModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedKey(null);
        }}
        onSave={handleEditKey}
        title="Edit API key"
        initialData={selectedKey ? {
          name: selectedKey.name,
          limit: selectedKey.monthly_limit,
          monthlyLimit: selectedKey.is_monthly_limit,
        } : undefined}
      />
    </div>
  );
} 