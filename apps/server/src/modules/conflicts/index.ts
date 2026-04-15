export { conflictsRoutes } from './routes.js';
export {
  detectConflict,
  isContradiction,
  resolveConflict,
  type ConflictCandidate,
  type ConflictDetectionResult,
  type ConflictResolutionStrategy,
  type ResolveConflictResult,
} from './conflictService.js';
export {
  detectConflictsSchema,
  resolveConflictSchema,
  type DetectConflictsInput,
  type ResolveConflictInput,
} from './schemas.js';
