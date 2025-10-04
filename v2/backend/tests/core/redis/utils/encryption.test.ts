/**
 * 加密工具单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  encryptSensitiveData,
  decryptSensitiveData,
  hashApiKey,
  generateSecretKey,
  resetEncryptionKeyCache
} from '@core/redis/utils/encryption'

describe('Encryption Utils', () => {
  beforeEach(() => {
    // 重置加密密钥缓存
    resetEncryptionKeyCache()
  })

  afterEach(() => {
    // 清理
    resetEncryptionKeyCache()
  })

  describe('encryptSensitiveData / decryptSensitiveData', () => {
    it('should encrypt and decrypt data correctly', () => {
      const original = 'sensitive-api-key-12345'
      const encrypted = encryptSensitiveData(original)
      const decrypted = decryptSensitiveData(encrypted)

      expect(encrypted).not.toBe(original)
      expect(decrypted).toBe(original)
    })

    it('should use iv:encrypted format', () => {
      const data = 'test-data'
      const encrypted = encryptSensitiveData(data)

      expect(encrypted).toContain(':')
      const parts = encrypted.split(':')
      expect(parts).toHaveLength(2)
      expect(parts[0]).toHaveLength(32) // 16 bytes IV in hex = 32 chars
    })

    it('should generate different ciphertext each time (different IV)', () => {
      const data = 'test-data'
      const encrypted1 = encryptSensitiveData(data)
      const encrypted2 = encryptSensitiveData(data)

      // Different IV means different ciphertext
      expect(encrypted1).not.toBe(encrypted2)

      // But both decrypt to same value
      expect(decryptSensitiveData(encrypted1)).toBe(data)
      expect(decryptSensitiveData(encrypted2)).toBe(data)
    })

    it('should handle empty string', () => {
      const encrypted = encryptSensitiveData('')
      expect(encrypted).toBe('')

      const decrypted = decryptSensitiveData('')
      expect(decrypted).toBe('')
    })

    it('should handle long data', () => {
      const longData = 'a'.repeat(10000)
      const encrypted = encryptSensitiveData(longData)
      const decrypted = decryptSensitiveData(encrypted)

      expect(decrypted).toBe(longData)
    })

    it('should handle special characters', () => {
      const specialData = '!@#$%^&*()_+-={}[]|\\:";\'<>,.?/~`'
      const encrypted = encryptSensitiveData(specialData)
      const decrypted = decryptSensitiveData(encrypted)

      expect(decrypted).toBe(specialData)
    })

    it('should handle unicode characters', () => {
      const unicodeData = '你好世界 🚀 éàü'
      const encrypted = encryptSensitiveData(unicodeData)
      const decrypted = decryptSensitiveData(encrypted)

      expect(decrypted).toBe(unicodeData)
    })

    it('should return original data on decrypt error (malformed input)', () => {
      const malformed = 'not-valid-encrypted-data'
      const result = decryptSensitiveData(malformed)

      // Should return original on error (v1 behavior)
      expect(result).toBe(malformed)
    })

    it('should handle data without colon separator', () => {
      const noColon = 'abcdef123456'
      const result = decryptSensitiveData(noColon)

      expect(result).toBe(noColon)
    })
  })

  describe('hashApiKey', () => {
    it('should generate SHA256 hash', () => {
      const apiKey = 'sk_test_1234567890'
      const hash = hashApiKey(apiKey)

      expect(hash).toHaveLength(64) // SHA256 hex = 64 chars
      expect(hash).toMatch(/^[a-f0-9]{64}$/) // Hex format
    })

    it('should be deterministic (same input = same hash)', () => {
      const apiKey = 'sk_test_1234567890'
      const hash1 = hashApiKey(apiKey)
      const hash2 = hashApiKey(apiKey)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashApiKey('key1')
      const hash2 = hashApiKey('key2')

      expect(hash1).not.toBe(hash2)
    })

    it('should use salt from ENCRYPTION_KEY', () => {
      // The hash should be different from plain SHA256
      const apiKey = 'test-key'
      const hash = hashApiKey(apiKey)

      // Create plain SHA256 without salt
      const crypto = require('crypto')
      const plainHash = crypto.createHash('sha256').update(apiKey).digest('hex')

      // Should be different (because we add ENCRYPTION_KEY as salt)
      expect(hash).not.toBe(plainHash)
    })
  })

  describe('generateSecretKey', () => {
    it('should generate random hex string', () => {
      const key = generateSecretKey()

      expect(key).toHaveLength(64) // 32 bytes = 64 hex chars
      expect(key).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should generate different keys each time', () => {
      const key1 = generateSecretKey()
      const key2 = generateSecretKey()

      expect(key1).not.toBe(key2)
    })

    it('should respect custom length', () => {
      const key16 = generateSecretKey(16)
      const key64 = generateSecretKey(64)

      expect(key16).toHaveLength(32) // 16 bytes = 32 hex
      expect(key64).toHaveLength(128) // 64 bytes = 128 hex
    })
  })

  describe('Encryption key caching', () => {
    it('should cache encryption key for performance', () => {
      const data1 = 'test1'
      const data2 = 'test2'

      // First call derives the key
      encryptSensitiveData(data1)

      // Second call should use cached key
      encryptSensitiveData(data2)

      // Both should still work
      const encrypted = encryptSensitiveData('test3')
      expect(decryptSensitiveData(encrypted)).toBe('test3')
    })

    it('should reset cache when resetEncryptionKeyCache is called', () => {
      encryptSensitiveData('test1')
      resetEncryptionKeyCache()
      const encrypted = encryptSensitiveData('test2')

      expect(decryptSensitiveData(encrypted)).toBe('test2')
    })
  })

  describe('Compatibility with v1', () => {
    it('should be compatible with v1 encryption format', () => {
      // Simulate v1 encrypted data format: iv:encrypted
      const testData = 'api-key-secret'

      // Encrypt with our function
      const encrypted = encryptSensitiveData(testData)

      // Verify format matches v1: "iv_hex:encrypted_hex"
      expect(encrypted).toMatch(/^[a-f0-9]{32}:[a-f0-9]+$/)

      // Verify can decrypt
      expect(decryptSensitiveData(encrypted)).toBe(testData)
    })
  })
})
