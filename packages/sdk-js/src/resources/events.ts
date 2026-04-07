import { EidolonDBClient } from '../client.js';
import type {
  CreateEventInput,
  Event,
  ListEventsOptions,
  ListEventsResponse,
  TimelineEntry,
  TimelineOptions,
} from '../types.js';

export class EventsResource {
  constructor(private readonly client: EidolonDBClient) {}

  /** Create an event. */
  create(input: CreateEventInput): Promise<Event> {
    const body = {
      ...input,
      timestamp: input.timestamp instanceof Date ? input.timestamp.toISOString() : input.timestamp,
    };

    return this.client.request<Event>('POST', '/events', body);
  }

  /** List events with optional filters. */
  async list(options?: ListEventsOptions): Promise<Event[]> {
    const response = await this.client.request<ListEventsResponse>('GET', '/events', undefined, {
      query: options,
    });

    return response.events;
  }

  /** Get event by ID. */
  get(id: string): Promise<Event> {
    return this.client.request<Event>('GET', `/events/${id}`);
  }

  /** Get timeline aggregation. */
  timeline(options?: TimelineOptions): Promise<TimelineEntry[]> {
    return this.client.request<TimelineEntry[]>('GET', '/events/timeline', undefined, {
      query: options,
    });
  }
}
