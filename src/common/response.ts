/**
 * Manuscript AI - Standard API Envelope and Error Types
 *
 * Implements the mandatory API contract:
 * Success: { success: true, data: T, meta: Record<string, any> | null }
 * Paginated: { success: true, data: T[], meta: { page, limit, total, totalPages } }
 * Error: { success: false, error: { code, message, details: any[] } }
 */

export interface ApiResponse<T = any> {
  success: true;
  data: T;
  meta: any | null;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiPaginatedResponse<T = any> {
  success: true;
  data: T[];
  meta: PaginatedMeta;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  constraint?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: ApiErrorDetail[];
  };
}

export class AppError extends Error {
  statusCode: number;
  code: string;
  details: ApiErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function successResponse<T>(data: T, meta: any = null): ApiResponse<T> {
  return {
    success: true,
    data,
    meta,
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number = 1,
  limit: number = 20,
): ApiPaginatedResponse<T> {
  const totalPages = Math.ceil(total / (limit || 1)) || 0;
  return {
    success: true,
    data,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages,
    },
  };
}

export function errorResponse(
  code: string,
  message: string,
  details: ApiErrorDetail[] = [],
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}
