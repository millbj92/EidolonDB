import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { EidolonDB } from '../src/index';

describe('Validate convenience method', () => {
  const url = 'http://localhost:3000';
  const tenant = 'test-tenant';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('db.validate returns supported verdict', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            verdict: 'supported',
            confidence: 0.92,
            claim: 'Project codename is Atlas',
            supporting: [
              {
                memoryId: '11111111-1111-1111-1111-111111111111',
                content: 'Project codename is Atlas.',
                similarity: 0.91,
                tier: 'semantic',
                createdAt: '2026-04-17T00:00:00.000Z',
              },
            ],
            contradicting: [],
            reasoning: 'Claim is directly present in semantic memory.',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    const result = await db.validate('Project codename is Atlas', { k: 3, threshold: 0.7 });

    expect(result.verdict).toBe('supported');
    expect(result.confidence).toBe(0.92);
    const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(`${url}/validate`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      claim: 'Project codename is Atlas',
      k: 3,
      threshold: 0.7,
    });
  });

  test('db.validate returns unverified verdict', async () => {
    const fetchMock = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            verdict: 'unverified',
            confidence: 0.31,
            claim: 'Customer uses SAML today',
            supporting: [],
            contradicting: [],
            reasoning: 'No sufficiently similar memories were found.',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const db = new EidolonDB({ url, tenant, fetch: fetchMock });
    const result = await db.validate('Customer uses SAML today');

    expect(result.verdict).toBe('unverified');
    expect(result.supporting).toHaveLength(0);
    expect(result.contradicting).toHaveLength(0);
    const [requestUrl, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(`${url}/validate`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      claim: 'Customer uses SAML today',
    });
  });
});
