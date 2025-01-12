export interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  usage: number;
  monthly_limit: number;
  is_monthly_limit: boolean;
  last_used_at?: string;
}

export interface VisibleKeys {
  [key: string]: boolean;
} 