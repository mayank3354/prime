'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  EyeIcon, 
  ClipboardDocumentIcon, 
  PencilSquareIcon, 
  TrashIcon 
} from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  usage: number;
  monthly_limit: number;
  is_monthly_limit: boolean;
  last_used_at?: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; limit: number; monthlyLimit: boolean }) => void;
  title: string;
  initialData?: {
    name: string;
    limit: number;
    monthlyLimit: boolean;
  };
}

interface VisibleKeys {
  [key: string]: boolean;
}

function ApiKeyModal({ isOpen, onClose, onSave, title, initialData }: ModalProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [limit, setLimit] = useState(initialData?.limit || 1000);
  const [monthlyLimit, setMonthlyLimit] = useState(initialData?.monthlyLimit || false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-6">{title}</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block mb-2">
              Key Name — <span className="text-gray-500">A unique name to identify this key</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="default"
              className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.checked)}
                className="rounded"
              />
              <span>Limit monthly usage*</span>
            </label>
            {monthlyLimit && (
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700"
              />
            )}
            <p className="text-sm text-gray-500 mt-2">
              * If the combined usage of all your keys exceeds your plan's limit, all requests will be rejected.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ name, limit, monthlyLimit })}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<VisibleKeys>({});
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    checkUser();
    fetchApiKeys();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Error checking user session:', error);
      router.push('/auth/login');
    }
  };

  const fetchApiKeys = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('No authenticated user found');
      }

      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast.error('Failed to load API keys');
    }
  };

  const handleCreateKey = async (data: { name: string; limit: number; monthlyLimit: boolean }) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('No authenticated user found');
      }

      const newKey = `prime_${Math.random().toString(36).substr(2, 16)}`;
      
      const { error } = await supabase
        .from('api_keys')
        .insert({
          user_id: session.user.id,
          name: data.name || 'default',
          key: newKey,
          monthly_limit: data.monthlyLimit ? data.limit : 1000,
          is_monthly_limit: data.monthlyLimit,
          usage: 0, // Add initial usage
        });

      if (error) throw error;
      
      setIsCreateModalOpen(false);
      toast.success('API key created successfully');
      fetchApiKeys();
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error(error.message || 'Failed to create API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditKey = async (data: { name: string; limit: number; monthlyLimit: boolean }) => {
    if (!selectedKey) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({
          name: data.name,
          monthly_limit: data.monthlyLimit ? data.limit : selectedKey.monthly_limit,
          is_monthly_limit: data.monthlyLimit,
        })
        .eq('id', selectedKey.id);

      if (error) throw error;
      
      setIsEditModalOpen(false);
      setSelectedKey(null);
      toast.success('API key updated successfully');
      fetchApiKeys(); // Refresh the list
    } catch (error) {
      console.error('Error updating API key:', error);
      toast.error('Failed to update API key');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('API key copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy API key');
    }
  };

  const confirmDelete = (key: ApiKey) => {
    setSelectedKey(key);
    setIsDeleteModalOpen(true);
  };

  const deleteApiKey = async () => {
    if (!selectedKey) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', selectedKey.id);

      if (error) throw error;
      
      setIsDeleteModalOpen(false);
      setSelectedKey(null);
      toast.success('API key deleted successfully');
      fetchApiKeys(); // Refresh the list
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
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

        {/* Current Plan Card with Gradient */}
        <div className="mb-8 rounded-xl overflow-hidden">
          <div className="p-8 bg-gradient-to-r from-rose-100 via-purple-200 to-blue-200 dark:from-rose-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="text-sm font-medium mb-2">CURRENT PLAN</div>
                <h2 className="text-4xl font-bold">Researcher</h2>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-gray-800/90 rounded-lg text-sm">
                <span>Manage Plan</span>
              </button>
            </div>
            
            <div>
              <div className="text-sm font-medium mb-2">API Limit</div>
              <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-2 mb-2">
                <div 
                  className="bg-black/20 dark:bg-white/20 h-full rounded-full" 
                  style={{ width: `${(apiKeys.reduce((acc, key) => acc + key.usage, 0) / 1000) * 100}%` }}
                />
              </div>
              <div className="text-sm">
                {apiKeys.reduce((acc, key) => acc + key.usage, 0)} / 1,000 Requests
              </div>
            </div>
          </div>
        </div>

        {/* API Keys Section */}
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

            {/* API Keys Table */}
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm">
                  <th className="pb-4">NAME</th>
                  <th className="pb-4">USAGE</th>
                  <th className="pb-4">KEY</th>
                  <th className="pb-4">OPTIONS</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((apiKey) => (
                  <tr key={apiKey.id} className="border-t dark:border-gray-700">
                    <td className="py-4">{apiKey.name}</td>
                    <td className="py-4">{apiKey.usage}</td>
                    <td className="py-4">
                      <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                        {visibleKeys[apiKey.id] 
                          ? apiKey.key
                          : apiKey.key.replace(/(?<=^.{4}).*(?=.{4}$)/g, '•'.repeat(24))}
                      </code>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleKeyVisibility(apiKey.id)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg group relative"
                          aria-label={visibleKeys[apiKey.id] ? "Hide API Key" : "Show API Key"}
                        >
                          <EyeIcon 
                            className={`w-5 h-5 ${
                              visibleKeys[apiKey.id]
                                ? 'text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                          />
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            {visibleKeys[apiKey.id] ? 'Hide Key' : 'Show Key'}
                          </span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(apiKey.key)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg group relative"
                          aria-label="Copy API Key"
                        >
                          <ClipboardDocumentIcon className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            Copy Key
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedKey(apiKey);
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg group relative"
                          aria-label="Edit API Key"
                        >
                          <PencilSquareIcon className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" />
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            Edit Key
                          </span>
                        </button>
                        <button
                          onClick={() => confirmDelete(apiKey)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg group relative"
                          aria-label="Delete API Key"
                        >
                          <TrashIcon className="w-5 h-5 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300" />
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            Delete Key
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                onClick={deleteApiKey}
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
          limit: selectedKey.limit,
          monthlyLimit: selectedKey.is_monthly_limit,
        } : undefined}
      />
    </div>
  );
} 