export { relationsRoutes } from './routes.js';
export {
  createRelation,
  getRelationById,
  listRelations,
  deleteRelation,
  traverseRelations,
  type ListRelationsResult,
} from './service.js';
export {
  relationNodeTypeSchema,
  createRelationSchema,
  relationResponseSchema,
  listRelationsQuerySchema,
  traverseRelationsQuerySchema,
  traverseRelationsResponseSchema,
  type RelationNodeType,
  type CreateRelationInput,
  type RelationResponse,
  type ListRelationsQueryInput,
  type TraverseRelationsQueryInput,
  type TraverseRelationsResponse,
} from './schemas.js';
