/**
 * 时区辅助函数
 * 完全复用 v1 的 redis.js 时区逻辑
 * 默认 UTC+8，可通过环境变量配置
 */

import { config } from '../../config'

/**
 * 获取某个时间点在目标时区的"本地"表示
 * 例如：UTC时间 2025-07-30 01:00:00 在 UTC+8 时区表示为 2025-07-30 09:00:00
 *
 * @param date - 源时间（默认当前时间）
 * @returns 偏移后的 Date 对象，其 getUTCXXX 方法返回目标时区的值
 */
export function getDateInTimezone(date: Date = new Date()): Date {
  const offset = config.TIMEZONE_OFFSET || 8 // 默认 UTC+8

  // 创建一个偏移后的 Date 对象，使其 getUTCXXX 方法返回目标时区的值
  const offsetMs = offset * 3600000 // 时区偏移的毫秒数
  const adjustedTime = new Date(date.getTime() + offsetMs)

  return adjustedTime
}

/**
 * 获取配置时区的日期字符串 (YYYY-MM-DD)
 *
 * @param date - 源时间（默认当前时间）
 * @returns YYYY-MM-DD 格式的日期字符串
 */
export function getDateStringInTimezone(date: Date = new Date()): string {
  const tzDate = getDateInTimezone(date)
  // 使用 UTC 方法获取偏移后的日期部分
  return `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(2, '0')}-${String(tzDate.getUTCDate()).padStart(2, '0')}`
}

/**
 * 获取配置时区的小时 (0-23)
 *
 * @param date - 源时间（默认当前时间）
 * @returns 0-23 的小时数
 */
export function getHourInTimezone(date: Date = new Date()): number {
  const tzDate = getDateInTimezone(date)
  return tzDate.getUTCHours()
}

/**
 * 获取配置时区的 ISO 周（YYYY-Wxx 格式，周一到周日）
 *
 * @param date - 源时间（默认当前时间）
 * @returns YYYY-Wxx 格式的周字符串
 */
export function getWeekStringInTimezone(date: Date = new Date()): string {
  const tzDate = getDateInTimezone(date)

  // 获取年份
  const year = tzDate.getUTCFullYear()

  // 计算 ISO 周数（周一为第一天）
  const dateObj = new Date(tzDate)
  const dayOfWeek = dateObj.getUTCDay() || 7 // 将周日(0)转换为7
  const firstThursday = new Date(dateObj)
  firstThursday.setUTCDate(dateObj.getUTCDate() + 4 - dayOfWeek) // 找到这周的周四

  const yearStart = new Date(firstThursday.getUTCFullYear(), 0, 1)
  const weekNumber = Math.ceil(((firstThursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)

  return `${year}-W${String(weekNumber).padStart(2, '0')}`
}

/**
 * 获取配置时区的月份字符串 (YYYY-MM)
 *
 * @param date - 源时间（默认当前时间）
 * @returns YYYY-MM 格式的月份字符串
 */
export function getMonthStringInTimezone(date: Date = new Date()): string {
  const tzDate = getDateInTimezone(date)
  return `${tzDate.getUTCFullYear()}-${String(tzDate.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * 获取配置时区的小时字符串 (YYYY-MM-DD:HH)
 *
 * @param date - 源时间（默认当前时间）
 * @returns YYYY-MM-DD:HH 格式的小时字符串
 */
export function getHourStringInTimezone(date: Date = new Date()): string {
  const today = getDateStringInTimezone(date)
  const currentHour = getHourInTimezone(date)
  return `${today}:${String(currentHour).padStart(2, '0')}`
}
