export type ResearchStatus = {
  stage: 'searching' | 'downloading' | 'processing' | 'analyzing' | 'complete';
  message: string;
  progress?: {
    current: number;
    total: number;
  };
};

export type StatusCallback = (status: ResearchStatus) => void; 