// Core types and interfaces for research agents
export interface CodeExample {
  title: string;
  language: string;
  code: string;
  description: string;
  source?: string;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  score?: number;
}

export interface TavilyResponse {
  results: TavilyResult[];
}

export interface ResearchStatus {
  stage: 'searching' | 'downloading' | 'processing' | 'analyzing' | 'complete';
  message: string;
  progress: { current: number; total: number };
}

export interface Statistic {
  metric: string;
  value: string;
  context: string;
  source: string;
}

export interface Finding {
  title: string;
  content: string;
  source: string;
  relevance: string;
  type: string;
  category?: string;
}

export interface ResearchMetadata {
  sourcesCount: number;
  confidence: number;
  researchDepth: string;
  lastUpdated: string;
  searchQueries: number;
  qualityScore: number;
  error?: boolean;
  errorMessage?: string;
}

export interface ResearchResult {
  summary: string;
  findings: Finding[];
  codeExamples: CodeExample[];
  suggestedQuestions: string[];
  statistics: Statistic[];
  metadata: ResearchMetadata;
} 