# Academic Research Agent - Modular Structure

This directory contains the modular academic research agent, which has been split into specialized components for better maintainability, testing, and reusability.

## Architecture Overview

The academic research agent has been refactored from a monolithic structure into specialized modules:

```
src/lib/agents/core/
├── academic-types.ts          # Type definitions and interfaces
├── arxiv-searcher.ts          # ArXiv paper search functionality
├── github-searcher.ts         # GitHub repository search functionality
├── pdf-processor.ts           # PDF processing and document handling
├── academic-rag-analyzer.ts   # RAG analysis and AI processing
├── modular-academic-agent.ts  # Main orchestrator agent
├── index.ts                   # Export aggregator
└── README.md                  # This documentation
```

## Components

### 1. `academic-types.ts`
Contains all TypeScript interfaces and type definitions used across the academic research system:
- `ArxivPaper` - ArXiv paper structure
- `CodeRepository` - GitHub repository structure  
- `Finding` - Research finding structure
- `KeyInsight` - Research insight structure
- `RAGResponse` - RAG analysis response structure
- `ResearchMetadata` - Research metadata structure

### 2. `arxiv-searcher.ts`
Handles ArXiv academic paper search and processing:
- Enhanced query construction with category filters
- Paper relevance scoring and filtering
- Handles API timeouts and errors gracefully
- Limits results to most relevant papers

### 3. `github-searcher.ts`
Manages GitHub repository search for code examples:
- Programming language detection and filtering
- Quality metrics (stars, activity, description)
- Repository relevance scoring
- Support for multiple programming languages

### 4. `pdf-processor.ts`
Processes academic papers and documents:
- PDF download and text extraction
- Text chunking and sanitization
- Vector embedding with batching and rate limiting
- Fallback handling for failed PDF processing

### 5. `academic-rag-analyzer.ts`
Performs RAG (Retrieval-Augmented Generation) analysis:
- Enhanced prompt construction for structured output
- Statistical data extraction from papers
- Code example extraction and formatting
- Methodology analysis and summarization

### 6. `modular-academic-agent.ts`
Main orchestrator that coordinates all specialized modules:
- Manages the research workflow
- Handles parallel processing of different sources
- Formats final research results
- Provides error handling and retry logic

## Usage

### Basic Usage

```typescript
import { ModularAcademicAgent } from './core/modular-academic-agent';

const agent = new ModularAcademicAgent((status) => {
  console.log('Research Status:', status);
});

const results = await agent.research('machine learning optimization');
```

### Using Individual Components

```typescript
import { ArxivSearcher, GitHubSearcher } from './core';

// Search only ArXiv papers
const arxivSearcher = new ArxivSearcher();
const papers = await arxivSearcher.searchPapers('neural networks');

// Search only GitHub repositories
const githubSearcher = new GitHubSearcher();
const repos = await githubSearcher.searchRepositories('python machine learning');
```

### Backward Compatibility

The original `AcademicResearchAgent` class has been maintained as a wrapper:

```typescript
import { AcademicResearchAgent } from '../academic-research-agent';

const agent = new AcademicResearchAgent();
const results = await agent.research('quantum computing');
```

## Benefits of Modular Structure

### 1. **Separation of Concerns**
Each module has a single responsibility:
- ArXiv searching is isolated from GitHub searching
- PDF processing is separate from RAG analysis
- Easy to understand and maintain individual components

### 2. **Testability**
Each module can be tested independently:
- Mock individual components for unit testing
- Test specific functionality without full system
- Easier debugging and error isolation

### 3. **Reusability**
Components can be used independently:
- Use ArXiv searcher in other research contexts
- Reuse PDF processor for different document types
- Apply RAG analyzer to other knowledge bases

### 4. **Maintainability**
- Smaller, focused files are easier to maintain
- Changes to one component don't affect others
- Clear interfaces between components

### 5. **Extensibility**
- Easy to add new search sources (e.g., IEEE, PubMed)
- Can swap out implementations (e.g., different PDF processors)
- Modular design supports plugin architecture

## Configuration

Each module accepts configuration through its constructor:

```typescript
// Configure with status callback
const statusCallback = (status) => console.log(status);

const arxivSearcher = new ArxivSearcher(statusCallback);
const pdfProcessor = new PDFProcessor(statusCallback);
```

## Error Handling

Each module implements robust error handling:
- Graceful degradation when APIs are unavailable
- Retry logic with exponential backoff
- Fallback strategies for failed operations
- Detailed error logging and reporting

## Performance Considerations

- **Parallel Processing**: ArXiv and GitHub searches run in parallel
- **Batch Processing**: PDF embedding uses batching to prevent rate limits
- **Caching**: Vector store maintains embedded documents for reuse
- **Rate Limiting**: Built-in delays prevent API throttling

## Future Enhancements

The modular structure makes it easy to add:
- Additional academic databases (IEEE, PubMed, Google Scholar)
- Different document processors (Word, PowerPoint, etc.)
- Alternative embedding models
- Custom ranking algorithms
- Real-time research monitoring

## Dependencies

Each module has minimal dependencies:
- `academic-types.ts` - No external dependencies
- `arxiv-searcher.ts` - axios, cheerio
- `github-searcher.ts` - axios
- `pdf-processor.ts` - pdfreader, langchain
- `academic-rag-analyzer.ts` - langchain, google-genai
- `modular-academic-agent.ts` - All above + supabase

This modular approach ensures that the academic research system is maintainable, extensible, and robust while providing excellent research capabilities. 