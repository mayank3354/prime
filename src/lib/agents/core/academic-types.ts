// Academic-specific interfaces and types
export interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  link: string;
  pdfLink?: string;
}

export interface CodeRepository {
  title: string;
  description: string;
  url: string;
  stars?: number;
  language?: string;
}

export interface GitHubRepo {
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  language: string;
}

export interface Finding {
  title: string;
  content: string;
  source: string;
  relevance: string;
  credibility: number;
  type: string;
  category: string;
}

export interface KeyInsight {
  point: string;
  explanation: string;
  supportingEvidence: string[];
}

export interface ResearchMetadata {
  sourcesCount: number;
  confidence: number;
  researchDepth: string;
  lastUpdated: string;
  error?: boolean;
  attempts?: number;
}

export interface RAGResponse {
  analysis: string;
  statistics: Array<{
    value: string;
    metric: string;
    context: string;
    source: string;
  }>;
  questions: string[];
  codeExamples: Array<{
    title: string;
    language: 'python' | 'javascript' | 'typescript' | string;
    code: string;
    description: string;
    source: string;
  }>;
  methodology: {
    approach: string;
    implementation: string;
    evaluation: string;
  };
} 