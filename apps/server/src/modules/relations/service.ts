import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db, relations, type NewRelation, type Relation } from '../../common/db/index.js';
import type {
  CreateRelationInput,
  ListRelationsQueryInput,
  RelationNodeType,
  TraverseRelationsQueryInput,
  TraverseRelationsResponse,
} from './schemas.js';

export async function createRelation(
  tenantId: string,
  input: CreateRelationInput
): Promise<Relation> {
  const newRelation: NewRelation = {
    tenantId,
    type: input.type,
    fromType: input.fromType,
    fromId: input.fromId,
    toType: input.toType,
    toId: input.toId,
    weight: input.weight ?? null,
    properties: input.properties,
    tags: input.tags,
  };

  const [relation] = await db.insert(relations).values(newRelation).returning();

  if (!relation) {
    throw new Error('Failed to create relation');
  }

  return relation;
}

export async function getRelationById(
  tenantId: string,
  id: string
): Promise<Relation | null> {
  const [relation] = await db
    .select()
    .from(relations)
    .where(and(eq(relations.id, id), eq(relations.tenantId, tenantId)))
    .limit(1);

  return relation ?? null;
}

export interface ListRelationsResult {
  relations: Relation[];
  total: number;
  offset: number;
  limit: number;
}

export async function listRelations(
  tenantId: string,
  input: ListRelationsQueryInput
): Promise<ListRelationsResult> {
  const { fromType, fromId, toType, toId, type, limit, offset } = input;
  const conditions = [eq(relations.tenantId, tenantId)];

  if (fromType) {
    conditions.push(eq(relations.fromType, fromType));
  }
  if (fromId) {
    conditions.push(eq(relations.fromId, fromId));
  }
  if (toType) {
    conditions.push(eq(relations.toType, toType));
  }
  if (toId) {
    conditions.push(eq(relations.toId, toId));
  }
  if (type) {
    conditions.push(eq(relations.type, type));
  }

  const whereClause = and(...conditions);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(relations)
    .where(whereClause);

  const rows = await db
    .select()
    .from(relations)
    .where(whereClause)
    .orderBy(desc(relations.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    relations: rows,
    total: Number(totalRow?.count ?? 0),
    offset,
    limit,
  };
}

export async function deleteRelation(
  tenantId: string,
  id: string
): Promise<boolean> {
  const result = await db
    .delete(relations)
    .where(and(eq(relations.id, id), eq(relations.tenantId, tenantId)))
    .returning({ id: relations.id });

  return result.length > 0;
}

function nodeKey(type: RelationNodeType, id: string): string {
  return `${type}:${id}`;
}

export async function traverseRelations(
  tenantId: string,
  input: TraverseRelationsQueryInput
): Promise<TraverseRelationsResponse> {
  const { startType, startId, relationTypes, depth, direction } = input;

  const visitedNodes = new Set<string>([nodeKey(startType, startId)]);
  const nodesMap = new Map<string, { type: RelationNodeType; id: string }>();
  const edgesMap = new Map<string, Relation>();

  nodesMap.set(nodeKey(startType, startId), {
    type: startType,
    id: startId,
  });

  let frontier: Array<{ type: RelationNodeType; id: string }> = [{ type: startType, id: startId }];

  for (let level = 0; level < depth; level++) {
    if (frontier.length === 0) {
      break;
    }

    const nextFrontier: Array<{ type: RelationNodeType; id: string }> = [];

    for (const node of frontier) {
      const directionalConditions = [];

      if (direction === 'outgoing' || direction === 'both') {
        directionalConditions.push(and(eq(relations.fromType, node.type), eq(relations.fromId, node.id)));
      }
      if (direction === 'incoming' || direction === 'both') {
        directionalConditions.push(and(eq(relations.toType, node.type), eq(relations.toId, node.id)));
      }

      if (directionalConditions.length === 0) {
        continue;
      }

      const whereParts = [
        eq(relations.tenantId, tenantId),
        directionalConditions.length === 1 ? directionalConditions[0]! : or(...directionalConditions),
      ];

      if (relationTypes && relationTypes.length > 0) {
        whereParts.push(inArray(relations.type, relationTypes));
      }

      const edges = await db
        .select()
        .from(relations)
        .where(and(...whereParts))
        .orderBy(asc(relations.createdAt));

      for (const edge of edges) {
        edgesMap.set(edge.id, edge);

        const fromNode = { type: edge.fromType, id: edge.fromId };
        const toNode = { type: edge.toType, id: edge.toId };

        nodesMap.set(nodeKey(fromNode.type, fromNode.id), fromNode);
        nodesMap.set(nodeKey(toNode.type, toNode.id), toNode);

        if (direction === 'outgoing') {
          const key = nodeKey(toNode.type, toNode.id);
          if (!visitedNodes.has(key)) {
            visitedNodes.add(key);
            nextFrontier.push(toNode);
          }
        } else if (direction === 'incoming') {
          const key = nodeKey(fromNode.type, fromNode.id);
          if (!visitedNodes.has(key)) {
            visitedNodes.add(key);
            nextFrontier.push(fromNode);
          }
        } else {
          const nextNodes = [fromNode, toNode];
          for (const nextNode of nextNodes) {
            const key = nodeKey(nextNode.type, nextNode.id);
            if (!visitedNodes.has(key)) {
              visitedNodes.add(key);
              nextFrontier.push(nextNode);
            }
          }
        }
      }
    }

    frontier = nextFrontier;
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()).map((edge) => ({
      id: edge.id,
      tenantId: edge.tenantId,
      type: edge.type,
      fromType: edge.fromType,
      fromId: edge.fromId,
      toType: edge.toType,
      toId: edge.toId,
      weight: edge.weight,
      properties: edge.properties ?? {},
      tags: edge.tags ?? [],
      createdAt: edge.createdAt.toISOString(),
      updatedAt: edge.updatedAt.toISOString(),
    })),
  };
}
