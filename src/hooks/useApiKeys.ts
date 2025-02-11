'use client';
import { useState, useEffect, } from 'react';
import { toast } from 'react-toastify';
import { ApiKey, VisibleKeys } from '@/types/api';
import { apiKeyService } from '@/services/apiKeyService';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<VisibleKeys>({});
  const supabase = createClientComponentClient();

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createApiKey = async (data: { name: string; limit: number; monthlyLimit: boolean }) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('No authenticated user found');
      }

      await apiKeyService.createApiKey(session.user.id, data);
      toast.success('API key created successfully');
      await fetchApiKeys();
    } catch (error: unknown) {
      console.error('Error creating API key:', error);
      toast.error('Failed to create API key');
    } finally {
      setIsLoading(false);
    }
  };

  const updateApiKey = async (keyId: string, data: { name: string; limit: number; monthlyLimit: boolean }) => {
    setIsLoading(true);
    try {
      await apiKeyService.updateApiKey(keyId, data);
      toast.success('API key updated successfully');
      await fetchApiKeys();
    } catch (error) {
      console.error('Error updating API key:', error);
      toast.error('Failed to update API key');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    setIsLoading(true);
    try {
      await apiKeyService.deleteApiKey(keyId);
      toast.success('API key deleted successfully');
      await fetchApiKeys();
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

  return {
    apiKeys,
    isLoading,
    visibleKeys,
    fetchApiKeys,
    createApiKey,
    updateApiKey,
    deleteApiKey,
    toggleKeyVisibility,
  };
} 