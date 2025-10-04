/**
 * 通用类型定义
 */

/**
 * Redis 字符串布尔值
 */
export type RedisBooleanString = 'true' | 'false' | ''

/**
 * 分页参数
 */
export interface PaginationOptions {
  page?: number
  pageSize?: number
  offset?: number
  limit?: number
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 排序选项
 */
export interface SortOptions {
  field: string
  order: 'asc' | 'desc'
}

/**
 * 筛选选项
 */
export interface FilterOptions {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains'
  value: string | number | boolean | string[] | number[]
}

/**
 * 时间范围
 */
export interface TimeRange {
  startDate: string // ISO 8601
  endDate: string // ISO 8601
}

/**
 * 标准响应格式
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  metadata?: {
    timestamp: string
    requestId?: string
  }
}
