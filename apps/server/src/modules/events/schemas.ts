import { z } from 'zod';

export const createEventSchema = z.object({
  actorEntityId: z.string().uuid().optional(),
  eventType: z.string().min(1),
  payload: z.record(z.unknown()).optional().default({}),
  tags: z.array(z.string()).optional().default([]),
  timestamp: z.coerce.date().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const eventResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  actorEntityId: z.string().uuid().nullable(),
  eventType: z.string(),
  timestamp: z.string(),
  payload: z.record(z.unknown()),
  tags: z.array(z.string()),
});

export type EventResponse = z.infer<typeof eventResponseSchema>;

export const listEventsQuerySchema = z.object({
  actorEntityId: z.string().uuid().optional(),
  eventType: z.string().min(1).optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ListEventsQueryInput = z.infer<typeof listEventsQuerySchema>;

export const timelineQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).optional().default(30),
  actorEntityId: z.string().uuid().optional(),
  eventType: z.string().min(1).optional(),
});

export type TimelineQueryInput = z.infer<typeof timelineQuerySchema>;

export const timelineRowSchema = z.object({
  date: z.string(),
  count: z.number(),
  types: z.record(z.number()),
});

export type TimelineRow = z.infer<typeof timelineRowSchema>;
