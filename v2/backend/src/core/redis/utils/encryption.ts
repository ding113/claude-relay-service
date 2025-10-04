/**
 * 加密工具
 * 完全复用 v1 的 claudeConsoleAccountService 加密逻辑
 * 使用 AES-256-CBC 加密敏感数据
 */

import crypto from 'crypto'
import { config } from '../../config'
import logger from '../../logger'

/**
 * 加密算法
 */
const ENCRYPTION_ALGORITHM = 'aes-256-cbc' as const

/**
 * 加密盐值（用于派生密钥）
 */
const ENCRYPTION_SALT = 'claude-console-salt' as const

/**
 * 缓存派生的加密密钥（性能优化）
 * scryptSync 是 CPU 密集型操作，缓存可以减少 95%+ 的 CPU 使用
 */
let encryptionKeyCache: Buffer | null = null

/**
 * 生成加密密钥
 * 使用 scryptSync 从配置的 encryptionKey 派生 32 字节密钥
 * 结果会被缓存以提升性能
 *
 * @returns 32 字节的密钥 Buffer
 */
function generateEncryptionKey(): Buffer {
  // 性能优化：缓存密钥派生结果，避免重复的 CPU 密集计算
  if (!encryptionKeyCache) {
    encryptionKeyCache = crypto.scryptSync(config.ENCRYPTION_KEY, ENCRYPTION_SALT, 32)
    logger.info('Encryption key derived and cached for performance optimization')
  }
  return encryptionKeyCache
}

/**
 * 加密敏感数据
 * 使用 AES-256-CBC 算法，输出格式: iv:encrypted
 *
 * @param data - 明文数据
 * @returns 加密后的数据（格式: iv:encrypted）或空字符串（输入为空时）
 */
export function encryptSensitiveData(data: string): string {
  if (!data) {
    return ''
  }

  try {
    const key = generateEncryptionKey()
    const iv = crypto.randomBytes(16)

    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return `${iv.toString('hex')}:${encrypted}`
  } catch (error) {
    logger.error('Encryption error', { error })
    return data // 失败时返回原文（v1 行为）
  }
}

/**
 * 解密敏感数据
 * 解析 iv:encrypted 格式并解密
 *
 * @param encryptedData - 加密数据（格式: iv:encrypted）
 * @returns 解密后的明文或空字符串（输入为空时）
 */
export function decryptSensitiveData(encryptedData: string): string {
  if (!encryptedData) {
    return ''
  }

  try {
    if (encryptedData.includes(':')) {
      const parts = encryptedData.split(':')
      if (parts.length === 2) {
        const key = generateEncryptionKey()
        const iv = Buffer.from(parts[0], 'hex')
        const encrypted = parts[1]

        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
        let decrypted = decipher.update(encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
      }
    }

    // 格式不对，返回原文
    return encryptedData
  } catch (error) {
    logger.error('Decryption error', { error })
    return encryptedData // 失败时返回原文（v1 行为）
  }
}

/**
 * 计算 SHA256 哈希
 * 用于 API Key 哈希（加盐）
 *
 * @param data - 原始数据
 * @returns SHA256 哈希值（hex 格式）
 */
export function hashApiKey(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data + config.ENCRYPTION_KEY) // 使用 encryptionKey 作为盐
    .digest('hex')
}

/**
 * 生成随机密钥
 * 用于生成新的 API Key
 *
 * @param length - 字节长度（默认 32）
 * @returns Hex 格式的随机字符串
 */
export function generateSecretKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * 重置加密密钥缓存
 * 仅用于测试或配置变更后重新初始化
 */
export function resetEncryptionKeyCache(): void {
  encryptionKeyCache = null
}
