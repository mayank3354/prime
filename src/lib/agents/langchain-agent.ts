// Backward compatibility export for the new modular ResearchAgent
export { ResearchAgent } from './research-agent';

// Export the new fast research agent for optimized performance
export { FastResearchAgent } from './fast-research-agent';

// Export core types for external use
export type {
  CodeExample,
  Finding,
  Statistic,
  ResearchResult,
  ResearchStatus,
  ResearchMetadata
} from './core/types';

// Export utility classes for advanced usage
export { SearchUtils } from './core/search-utils';
export { DocumentProcessor } from './core/document-processor';
export { ContentAnalyzer } from './core/content-analyzer';
export { CodeProcessor } from './core/code-processor';
export { TavilySearcher } from './core/tavily-searcher';
export { SpeedOptimizer } from './core/speed-optimizer'; 