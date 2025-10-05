import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, generatePassword } from '@/core/utils/password'

describe('Password Utils', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'test-password-123'
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).toContain('.')
      expect(hash.split('.').length).toBe(2)
    })

    it('should generate different hashes for same password', async () => {
      const password = 'test-password-123'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toBe(hash2)
    })

    it('should generate hash with correct format', async () => {
      const password = 'test-password-123'
      const hash = await hashPassword(password)
      const [salt, key] = hash.split('.')

      // Salt should be 32 hex chars (16 bytes)
      expect(salt.length).toBe(32)
      expect(/^[a-f0-9]+$/.test(salt)).toBe(true)

      // Key should be 128 hex chars (64 bytes)
      expect(key.length).toBe(128)
      expect(/^[a-f0-9]+$/.test(key)).toBe(true)
    })
  })

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'test-password-123'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'test-password-123'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword('wrong-password', hash)
      expect(isValid).toBe(false)
    })

    it('should handle empty password', async () => {
      const hash = await hashPassword('test')

      const isValid = await verifyPassword('', hash)
      expect(isValid).toBe(false)
    })

    it('should throw error for invalid hash format', async () => {
      await expect(verifyPassword('password', 'invalid-hash')).rejects.toThrow(
        'Invalid password hash format'
      )
    })

    it('should throw error for hash without separator', async () => {
      await expect(verifyPassword('password', 'invalidhashnoseparator')).rejects.toThrow(
        'Invalid password hash format'
      )
    })
  })

  describe('generatePassword', () => {
    it('should generate password with default length', () => {
      const password = generatePassword()

      expect(password.length).toBe(20)
    })

    it('should generate password with custom length', () => {
      const password = generatePassword(30)

      expect(password.length).toBe(30)
    })

    it('should generate different passwords', () => {
      const password1 = generatePassword()
      const password2 = generatePassword()

      expect(password1).not.toBe(password2)
    })

    it('should contain uppercase letters', () => {
      const password = generatePassword(50)

      expect(/[A-Z]/.test(password)).toBe(true)
    })

    it('should contain lowercase letters', () => {
      const password = generatePassword(50)

      expect(/[a-z]/.test(password)).toBe(true)
    })

    it('should contain digits', () => {
      const password = generatePassword(50)

      expect(/[0-9]/.test(password)).toBe(true)
    })

    it('should contain special characters', () => {
      const password = generatePassword(50)

      expect(/[!@#$%^&*]/.test(password)).toBe(true)
    })

    it('should only contain allowed characters', () => {
      const password = generatePassword(100)
      const allowedChars =
        /^[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*]+$/

      expect(allowedChars.test(password)).toBe(true)
    })
  })

  describe('Integration', () => {
    it('should hash and verify generated password', async () => {
      const password = generatePassword()
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should work with special characters in password', async () => {
      const password = 'P@ssw0rd!#$%^&*()'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should work with unicode characters in password', async () => {
      const password = '密码测试🔐'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })
  })
})
