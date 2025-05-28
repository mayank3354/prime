import { StatusCallback } from "@/types/research";
import { ModularAcademicAgent } from "./core/modular-academic-agent";

/**
 * Academic Research Agent - Wrapper for the modular academic agent
 * Maintains backward compatibility while using the new modular structure
 */
export class AcademicResearchAgent {
  private modularAgent: ModularAcademicAgent;

  constructor(statusCallback?: StatusCallback) {
    this.modularAgent = new ModularAcademicAgent(statusCallback);
  }

  /**
   * Research method that delegates to the modular agent
   */
  async research(query: string) {
    return await this.modularAgent.research(query);
  }
} 