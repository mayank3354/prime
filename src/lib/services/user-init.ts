import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export async function initializeNewUser(userId: string) {
  const supabase = createClientComponentClient();
  
  try {
    // Create default API key for new user
    const newKey = `prime_${Math.random().toString(36).substr(2, 16)}`;
    
    const { error: apiKeyError } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name: 'default',
        key: newKey,
        monthly_limit: 1000,
        is_monthly_limit: true,
        usage: 0,
        created_at: new Date().toISOString()
      });

    if (apiKeyError) throw apiKeyError;

    return true;
  } catch (error) {
    console.error('Error initializing user:', error);
    return false;
  }
} 