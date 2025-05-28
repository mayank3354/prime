import axios from 'axios';
import { CodeRepository, GitHubRepo } from './academic-types';
import { ResearchStatus, StatusCallback } from '@/types/research';

/**
 * GitHub repository search and analysis utilities
 */
export class GitHubSearcher {
  private statusCallback?: StatusCallback;

  constructor(statusCallback?: StatusCallback) {
    this.statusCallback = statusCallback;
  }

  private updateStatus(status: ResearchStatus): void {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  async searchRepositories(query: string): Promise<CodeRepository[]> {
    try {
      this.updateStatus({
        stage: 'searching',
        message: 'Searching GitHub repositories...',
        progress: { current: 2, total: 5 }
      });

      // Enhanced GitHub search with better query construction
      const searchQuery = this.enhanceGitHubQuery(query);
      
      const response = await axios.get(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=8`,
        {
          timeout: 10000,
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Academic-Research-Agent'
          }
        }
      );

      const repositories = response.data.items
        .filter((repo: GitHubRepo) => this.isRelevantRepository(repo, query))
        .map((repo: GitHubRepo) => ({
          title: repo.full_name,
          description: repo.description || 'No description available',
          url: repo.html_url,
          stars: repo.stargazers_count,
          language: repo.language || 'Unknown'
        }));

      console.log(`Found ${repositories.length} relevant repositories`);
      return repositories;
    } catch (error) {
      console.error('GitHub search error:', error);
      return [];
    }
  }

  private enhanceGitHubQuery(query: string): string {
    const queryLower = query.toLowerCase();
    let enhancedQuery = query;
    
    // Add language filters for programming queries
    if (queryLower.includes('python')) {
      enhancedQuery += ' language:python';
    } else if (queryLower.includes('javascript') || queryLower.includes('js')) {
      enhancedQuery += ' language:javascript';
    } else if (queryLower.includes('typescript') || queryLower.includes('ts')) {
      enhancedQuery += ' language:typescript';
    }
    
    // Add quality filters
    enhancedQuery += ' stars:>10 pushed:>2022-01-01';
    
    return enhancedQuery;
  }

  private isRelevantRepository(repo: GitHubRepo, query: string): boolean {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    const repoText = `${repo.full_name} ${repo.description || ''}`.toLowerCase();
    
    // Check relevance and quality
    const hasRelevantTerms = queryTerms.some(term => repoText.includes(term));
    const hasMinimumStars = repo.stargazers_count >= 5;
    const hasDescription = Boolean(repo.description && repo.description.length > 10);
    
    return hasRelevantTerms && hasMinimumStars && hasDescription;
  }

  /**
   * Get programming language filter for query
   */
  static getLanguageFilter(query: string): string | null {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('python')) return 'python';
    if (queryLower.includes('javascript') || queryLower.includes('js')) return 'javascript';
    if (queryLower.includes('typescript') || queryLower.includes('ts')) return 'typescript';
    if (queryLower.includes('java') && !queryLower.includes('javascript')) return 'java';
    if (queryLower.includes('c++') || queryLower.includes('cpp')) return 'c++';
    if (queryLower.includes('c#') || queryLower.includes('csharp')) return 'c#';
    if (queryLower.includes('go') || queryLower.includes('golang')) return 'go';
    if (queryLower.includes('rust')) return 'rust';
    if (queryLower.includes('swift')) return 'swift';
    if (queryLower.includes('kotlin')) return 'kotlin';
    if (queryLower.includes('php')) return 'php';
    if (queryLower.includes('ruby')) return 'ruby';
    
    return null;
  }

  /**
   * Check if repository meets quality standards
   */
  static isQualityRepository(repo: GitHubRepo): boolean {
    return (
      repo.stargazers_count >= 5 &&
      Boolean(repo.description) &&
      repo.description.length > 10 &&
      repo.language !== null
    );
  }
} 