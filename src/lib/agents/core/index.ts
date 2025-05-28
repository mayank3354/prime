// Academic Research Agent Core Modules
export * from './academic-types';
export * from './arxiv-searcher';
export * from './github-searcher';
export * from './pdf-processor';
export * from './academic-rag-analyzer';
export * from './modular-academic-agent';

// Re-export commonly used types
export type {
  ArxivPaper,
  CodeRepository,
  GitHubRepo,
  Finding,
  KeyInsight,
  ResearchMetadata,
  RAGResponse
} from './academic-types'; 