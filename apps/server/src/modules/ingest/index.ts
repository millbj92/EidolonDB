export { ingestRoutes } from './routes.js';
export { runIngestPipeline, type IngestPipelineResult } from './service.js';
export { extractCandidateMemories, EXTRACTOR_VERSION, PROMPT_VERSION } from './extractionService.js';
export { checkDedup, type DedupResult } from './dedupService.js';
export {
  ingestRequestSchema,
  ingestResponseSchema,
  dedupStatusSchema,
  candidateMemorySchema,
  extractorOutputSchema,
  type IngestRequest,
  type IngestResponse,
  type CandidateMemory,
  type ExtractorOutput,
  type DedupStatus,
  type AcceptedMemory,
  type RejectedMemory,
} from './schemas.js';
