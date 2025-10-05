/**
 * 时区函数单元测试
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  getDateInTimezone,
  getDateStringInTimezone,
  getHourInTimezone,
  getWeekStringInTimezone,
  getMonthStringInTimezone,
  getHourStringInTimezone
} from '@core/redis/utils/timezone'

describe('Timezone Utils', () => {
  let testDate: Date

  beforeAll(() => {
    // 使用固定的测试时间: 2025-10-04 18:30:00 UTC
    testDate = new Date('2025-10-04T18:30:00.000Z')
  })

  describe('getDateInTimezone', () => {
    it('should offset date by configured timezone (UTC+8)', () => {
      const result = getDateInTimezone(testDate)
      // UTC 18:30 + 8 hours = 02:30 next day
      expect(result.getUTCHours()).toBe(2)
      expect(result.getUTCDate()).toBe(5) // next day
    })

    it('should use current date when no parameter provided', () => {
      const result = getDateInTimezone()
      expect(result).toBeInstanceOf(Date)
    })
  })

  describe('getDateStringInTimezone', () => {
    it('should return YYYY-MM-DD format in timezone', () => {
      const result = getDateStringInTimezone(testDate)
      // UTC 2025-10-04 18:30 in UTC+8 is 2025-10-05 02:30
      expect(result).toBe('2025-10-05')
    })

    it('should pad month and day with zeros', () => {
      // 2025-01-01 00:00 UTC -> 2025-01-01 08:00 UTC+8
      const date = new Date('2025-01-01T00:00:00.000Z')
      const result = getDateStringInTimezone(date)
      expect(result).toBe('2025-01-01')
    })
  })

  describe('getHourInTimezone', () => {
    it('should return hour in timezone (0-23)', () => {
      const result = getHourInTimezone(testDate)
      // UTC 18:30 + 8 hours = 02:30
      expect(result).toBe(2)
    })

    it('should handle hour overflow correctly', () => {
      // UTC 23:00 + 8 = 07:00 next day
      const date = new Date('2025-10-04T23:00:00.000Z')
      const result = getHourInTimezone(date)
      expect(result).toBe(7)
    })
  })

  describe('getMonthStringInTimezone', () => {
    it('should return YYYY-MM format', () => {
      const result = getMonthStringInTimezone(testDate)
      expect(result).toBe('2025-10')
    })

    it('should pad month with zero', () => {
      const date = new Date('2025-01-15T12:00:00.000Z')
      const result = getMonthStringInTimezone(date)
      expect(result).toBe('2025-01')
    })
  })

  describe('getHourStringInTimezone', () => {
    it('should return YYYY-MM-DD:HH format', () => {
      const result = getHourStringInTimezone(testDate)
      // UTC 2025-10-04 18:30 -> UTC+8 2025-10-05 02:30
      expect(result).toBe('2025-10-05:02')
    })

    it('should pad hour with zero', () => {
      // UTC 00:00 + 8 = 08:00
      const date = new Date('2025-10-04T00:00:00.000Z')
      const result = getHourStringInTimezone(date)
      expect(result).toBe('2025-10-04:08')
    })
  })

  describe('getWeekStringInTimezone', () => {
    it('should return ISO week format YYYY-Wxx', () => {
      const result = getWeekStringInTimezone(testDate)
      // 2025-10-05 (Sunday in UTC+8) is in week 40
      expect(result).toMatch(/^\d{4}-W\d{2}$/)
    })

    it('should handle year boundary correctly', () => {
      // Week at year end
      const date = new Date('2024-12-30T12:00:00.000Z')
      const result = getWeekStringInTimezone(date)
      expect(result).toMatch(/^\d{4}-W\d{2}$/)
    })

    it('should pad week number with zero', () => {
      // Early weeks in year should have leading zero
      const date = new Date('2025-01-05T12:00:00.000Z')
      const result = getWeekStringInTimezone(date)
      expect(result).toMatch(/^\d{4}-W0\d$/)
    })
  })

  describe('Edge cases', () => {
    it('should handle daylight saving time transitions', () => {
      // Note: UTC+8 does not have DST, but test for consistency
      const date = new Date('2025-03-08T12:00:00.000Z')
      const result = getDateStringInTimezone(date)
      expect(result).toBe('2025-03-08')
    })

    it('should handle leap year', () => {
      const date = new Date('2024-02-29T12:00:00.000Z')
      const result = getDateStringInTimezone(date)
      expect(result).toBe('2024-02-29')
    })
  })
})
