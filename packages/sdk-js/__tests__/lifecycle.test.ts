import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { EidolonDB } from '../src/index';

describe('LifecycleResource', () => {
  const url = 'http://localhost:3000';
  const tenant = 'test-tenant';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('db.lifecycle.run() calls POST /lifecycle/run', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          runId: '00000000-0000-0000-0000-000000000010',
          dryRun: false,
          summary: { expired: 0, promoted: 0, distilled: 0, archived: 0, unchanged: 1, durationMs: 12 },
          details: [],
          errors: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    const response = await db.lifecycle.run();

    expect(response.success).toBe(true);
    const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(`${url}/lifecycle/run`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({});
  });

  test('db.lifecycle.run({ dryRun: true }) passes dryRun in body', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          runId: '00000000-0000-0000-0000-000000000011',
          dryRun: true,
          summary: { expired: 0, promoted: 0, distilled: 0, archived: 0, unchanged: 1, durationMs: 10 },
          details: [],
          errors: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    await db.lifecycle.run({ dryRun: true });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ dryRun: true });
  });

  test('response shape matches LifecycleRunResponse', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          runId: '00000000-0000-0000-0000-000000000012',
          dryRun: false,
          summary: { expired: 1, promoted: 2, distilled: 3, archived: 4, unchanged: 5, durationMs: 99 },
          details: [
            {
              memoryId: '00000000-0000-0000-0000-000000000013',
              action: 'promoted',
              fromTier: 'short_term',
              toTier: 'episodic',
              reason: 'threshold met',
            },
          ],
          errors: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    const response = await db.lifecycle.run();

    expect(response.summary.promoted).toBe(2);
    expect(response.details[0]?.action).toBe('promoted');
  });
});
