import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
//import { ApiKey } from '@/types/api';

const supabase = createClientComponentClient();

export const apiKeyService = {
  async fetchApiKeys() {
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
    return data;
  },

  async createApiKey(userId: string, data: { name: string; monthlyLimit: boolean; limit: number }) {
    const newKey = `prime_${Math.random().toString(36).substr(2, 16)}`;
    
    const { error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name: data.name || 'default',
        key: newKey,
        monthly_limit: data.monthlyLimit ? data.limit : 1000,
        is_monthly_limit: data.monthlyLimit,
        usage: 0,
      });

    if (error) throw error;
  },

  async updateApiKey(keyId: string, data: { name: string; monthlyLimit: boolean; limit: number }) {
    const { error } = await supabase
      .from('api_keys')
      .update({
        name: data.name,
        monthly_limit: data.monthlyLimit ? data.limit : 1000,
        is_monthly_limit: data.monthlyLimit,
      })
      .eq('id', keyId);

    if (error) throw error;
  },

  async deleteApiKey(keyId: string) {
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId);

    if (error) throw error;
  }
}; 