import { z } from 'zod';

// Common request/response schemas
export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const tenantHeaderSchema = z.object({
  'x-tenant-id': z.string().min(1),
});

export type TenantHeader = z.infer<typeof tenantHeaderSchema>;

// API response wrappers
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
