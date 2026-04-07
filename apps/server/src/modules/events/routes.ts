import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createEventSchema, listEventsQuerySchema, timelineQuerySchema } from './schemas.js';
import { createEvent, getEventById, getTimeline, listEvents } from './service.js';

function getTenantId(request: FastifyRequest): string {
  const tenantId = request.headers['x-tenant-id'];
  if (typeof tenantId !== 'string' || !tenantId) {
    throw new Error('x-tenant-id header is required');
  }
  return tenantId;
}

function eventToResponse(event: {
  id: string;
  tenantId: string;
  actorEntityId: string | null;
  eventType: string;
  timestamp: Date;
  payload: Record<string, unknown> | null;
  tags: string[] | null;
}) {
  return {
    id: event.id,
    tenantId: event.tenantId,
    actorEntityId: event.actorEntityId,
    eventType: event.eventType,
    timestamp: event.timestamp.toISOString(),
    payload: event.payload ?? {},
    tags: event.tags ?? [],
  };
}

export async function eventsRoutes(fastify: FastifyInstance) {
  // Create event
  fastify.post('/events', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const input = createEventSchema.parse(request.body);
      const event = await createEvent(tenantId, input);

      return reply.status(201).send({
        data: eventToResponse(event),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'x-tenant-id header is required') {
        return reply.status(400).send({
          error: {
            code: 'MISSING_TENANT_ID',
            message: error.message,
          },
        });
      }
      throw error;
    }
  });

  // Timeline aggregation
  fastify.get('/events/timeline', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const query = timelineQuerySchema.parse(request.query);
      const timeline = await getTimeline(tenantId, query);
      return reply.status(200).send({ data: timeline });
    } catch (error) {
      if (error instanceof Error && error.message === 'x-tenant-id header is required') {
        return reply.status(400).send({
          error: {
            code: 'MISSING_TENANT_ID',
            message: error.message,
          },
        });
      }
      throw error;
    }
  });

  // List/query events
  fastify.get('/events', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const query = listEventsQuerySchema.parse(request.query);
      const result = await listEvents(tenantId, query);

      return reply.status(200).send({
        data: {
          events: result.events.map(eventToResponse),
          total: result.total,
          offset: result.offset,
          limit: result.limit,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'x-tenant-id header is required') {
        return reply.status(400).send({
          error: {
            code: 'MISSING_TENANT_ID',
            message: error.message,
          },
        });
      }
      throw error;
    }
  });

  // Get event by ID
  fastify.get<{ Params: { id: string } }>('/events/:id', async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params;
      const event = await getEventById(tenantId, id);

      if (!event) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Event with id ${id} not found`,
          },
        });
      }

      return reply.status(200).send({
        data: eventToResponse(event),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'x-tenant-id header is required') {
        return reply.status(400).send({
          error: {
            code: 'MISSING_TENANT_ID',
            message: error.message,
          },
        });
      }
      throw error;
    }
  });
}
