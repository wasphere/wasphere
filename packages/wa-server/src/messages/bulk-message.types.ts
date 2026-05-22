export type BulkJobStatus = 'running' | 'completed' | 'failed';
export type BulkOutcomeStatus = 'pending' | 'sent' | 'failed';

export interface BulkOutcome {
  recipient: string;
  index: number;
  status: BulkOutcomeStatus;
  messageId?: string;
  error?: string;
  timestamp?: number;
}

export interface BulkJob {
  jobId: string;
  sessionId: string;
  total: number;
  sent: number;
  failed: number;
  status: BulkJobStatus;
  createdAt: number;
  outcomes: BulkOutcome[];
}
