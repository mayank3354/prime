# Research Agents - Modular Architecture

This directory contains a modular research agent system designed for flexibility, maintainability, and performance optimization.

## Architecture Overview

The research agents have been split into specialized modules to enable:
- **Better maintainability**: Each component has a single responsibility
- **Improved performance**: Speed optimizations and efficient processing
- **Enhanced accuracy**: Better search strategies and content analysis
- **Easy testing**: Isolated components for unit testing

## Core Modules (`/core/`)

### `types.ts`
Contains all TypeScript interfaces and type definitions:
- `ResearchResult` - Main research output interface
- `Finding` - Individual research findings
- `CodeExample` - Programming code examples
- `Statistic` - Numerical data and metrics
- `ResearchMetadata` - Quality and confidence metrics

### `search-utils.ts`
Search optimization utilities:
- Query generation and enhancement
- Domain filtering and ranking
- Result deduplication and scoring
- Programming query detection

### `document-processor.ts`
Document quality filtering and processing:
- Quality document filtering
- Enhanced RAG retrieval
- Confidence score calculation
- Content ranking algorithms

### `content-analyzer.ts`
Content analysis and extraction:
- Enhanced summary generation
- Structured findings extraction
- Contextual question generation
- Statistics validation and parsing

### `code-processor.ts`
Programming-specific content processing:
- Code block extraction from documents
- Language detection from queries
- AI-generated code examples
- Code validation and formatting

### `tavily-searcher.ts`
Tavily API integration:
- Multiple search strategies
- Rate limiting and error handling
- Result optimization
- Fallback mechanisms

### `speed-optimizer.ts`
Performance optimization utilities:
- Query complexity analysis
- Optimal strategy selection
- Timeout management
- Batch processing

## Main Agent Classes

### `ResearchAgent` (`research-agent.ts`)
The comprehensive research agent with full feature support:
```typescript
import { ResearchAgent } from './research-agent';

const agent = new ResearchAgent();
const result = await agent.research("your query here");
```

**Features:**
- Complete research analysis
- Code examples for programming queries
- Statistical data extraction
- Contextual questions
- High-quality findings

### `FastResearchAgent` (`fast-research-agent.ts`)
Speed-optimized agent for quick results:
```typescript
import { FastResearchAgent } from './fast-research-agent';

const fastAgent = new FastResearchAgent();
const result = await fastAgent.research("your query here");
```

**Features:**
- Adaptive strategy selection
- Timeout-based processing
- Optimized document handling
- Concurrent processing
- Fallback mechanisms

## Usage Examples

### Basic Research
```typescript
import { ResearchAgent } from '@/lib/agents/langchain-agent';

const agent = new ResearchAgent();
const results = await agent.research("Next.js 14 new features");

console.log(results.summary);
console.log(results.findings);
console.log(results.codeExamples);
```

### Fast Research
```typescript
import { FastResearchAgent } from '@/lib/agents/langchain-agent';

const fastAgent = new FastResearchAgent();
const results = await fastAgent.research("React hooks best practices");

console.log(`Research completed with ${results.metadata.confidence} confidence`);
```

### Streaming Research
```typescript
const results = await agent.researchWithStreaming(
  "machine learning algorithms",
  (status) => {
    console.log(`${status.stage}: ${status.message}`);
    console.log(`Progress: ${status.progress.current}/${status.progress.total}`);
  }
);
```

### Using Individual Components
```typescript
import { 
  SearchUtils, 
  DocumentProcessor, 
  ContentAnalyzer,
  SpeedOptimizer 
} from '@/lib/agents/langchain-agent';

// Generate optimized search queries
const queries = SearchUtils.generateSearchQueries("Python web frameworks");

// Determine optimal strategy
const strategy = SpeedOptimizer.getOptimalSearchStrategy("complex query here");

// Process documents
const filteredDocs = DocumentProcessor.filterQualityDocuments(documents);
```

## Performance Optimization

The modular architecture provides several performance benefits:

### 1. Adaptive Strategy Selection
- **Quick**: Simple queries (< 30 chars, ≤ 5 words)
- **Standard**: Most queries
- **Comprehensive**: Complex queries (> 100 chars, > 15 words)

### 2. Timeout Management
- Quick: 3s search, 5s processing
- Standard: 5s search, 10s processing  
- Comprehensive: 8s search, 15s processing

### 3. Document Optimization
- Quality filtering removes low-value content
- Speed scoring prioritizes processing order
- Batch processing improves efficiency

### 4. Concurrent Processing
- Parallel execution of analysis tasks
- Conditional feature generation based on strategy
- Optimized resource utilization

## Configuration

### Environment Variables
```env
GOOGLE_API_KEY=your_gemini_api_key
TAVILY_API_KEY=your_tavily_api_key
```

### Model Configuration
The agents use optimized Gemini configurations:
- **ResearchAgent**: Higher token limit for comprehensive analysis
- **FastResearchAgent**: Lower temperature and tokens for speed

## Error Handling

All agents include comprehensive error handling:
- API timeout protection
- Fallback content generation
- Graceful degradation
- Detailed error metadata

## Testing

Each module can be tested independently:
```typescript
import { SearchUtils } from '@/lib/agents/core/search-utils';

// Test search query generation
const queries = SearchUtils.generateSearchQueries("test query");
expect(queries).toHaveLength(3);
```

## Migration from Old Architecture

The new modular system maintains backward compatibility:
```typescript
// Old usage still works
import { ResearchAgent } from '@/lib/agents/langchain-agent';

// New optimized usage
import { FastResearchAgent } from '@/lib/agents/langchain-agent';
```

## Contributing

When adding new features:
1. Create specific modules in `/core/` for new functionality
2. Update type definitions in `types.ts`
3. Add exports to `langchain-agent.ts`
4. Update this README with usage examples
5. Add appropriate error handling and fallbacks

## Performance Monitoring

The research results include metadata for monitoring:
```typescript
const result = await agent.research("query");

console.log({
  sources: result.metadata.sourcesCount,
  confidence: result.metadata.confidence,
  quality: result.metadata.qualityScore,
  strategy: result.metadata.researchDepth,
  errors: result.metadata.error
});
``` 