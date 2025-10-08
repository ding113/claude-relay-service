import { randomBytes, createHash } from 'crypto'
import type Redis from 'ioredis'
import { config } from '@/core/config'
import logger from '@/core/logger'
import redisClient from '@/core/redis/client'
import { createApiKeyRepository, ApiKeyRepository } from '@/core/redis/repositories/apikey.repository'
import { createUsageRepository } from '@/core/redis/repositories/usage.repository'
import type {
  ApiKey,
  ApiKeyData,
  CreateApiKeyOptions,
  UpdateApiKeyOptions
} from '@/shared/types'

export class ApiKeyService {
  private apiKeyRepo: ApiKeyRepository
  private usageRepo

  constructor(redis?: Redis) {
    const client = redis || redisClient.getClient()
    this.apiKeyRepo = createApiKeyRepository(client)
    this.usageRepo = createUsageRepository(client)
  }

  /**
   * Generate a new API Key string
   * Format: {prefix}{32-char-hex}
   */
  private generateApiKeyString(): string {
    const randomPart = randomBytes(16).toString('hex')
    return `${config.API_KEY_PREFIX}${randomPart}`
  }

  /**
   * Hash API Key using SHA256
   */
  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex')
  }

  /**
   * Convert ApiKeyData (Redis format) to ApiKey (business format)
   */
  private parseApiKeyData(data: ApiKeyData): ApiKey {
    return {
      id: data.id,
      name: data.name || '',
      description: data.description || '',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastUsedAt: data.lastUsedAt || '',

      // Status
      isActive: data.isActive === 'true',
      isDeleted: data.isDeleted === 'true',
      deletedAt: data.deletedAt || undefined,
      deletedBy: data.deletedBy || undefined,
      deletedByType: data.deletedByType || undefined,
      restoredAt: data.restoredAt || undefined,
      restoredBy: data.restoredBy || undefined,
      restoredByType: data.restoredByType || undefined,

      // Expiration
      expiresAt: data.expiresAt || undefined,
      expirationMode: (data.expirationMode as 'fixed' | 'activation') || 'fixed',
      isActivated: data.isActivated === 'true',
      activatedAt: data.activatedAt || undefined,
      activationDays: parseInt(data.activationDays) || 0,
      activationUnit: (data.activationUnit as 'hours' | 'days') || 'days',

      // Account binding
      claudeConsoleAccountId: data.claudeConsoleAccountId || undefined,
      codexAccountId: data.codexAccountId || undefined,

      // Permissions
      permissions: (data.permissions as 'all' | 'claude' | 'codex') || 'all',
      enableModelRestriction: data.enableModelRestriction === 'true',
      restrictedModels: data.restrictedModels ? JSON.parse(data.restrictedModels) : [],
      enableClientRestriction: data.enableClientRestriction === 'true',
      allowedClients: data.allowedClients ? JSON.parse(data.allowedClients) : [],

      // Rate limits
      tokenLimit: parseInt(data.tokenLimit) || 0,
      concurrencyLimit: parseInt(data.concurrencyLimit) || 0,
      rateLimitWindow: parseInt(data.rateLimitWindow) || 0,
      rateLimitRequests: parseInt(data.rateLimitRequests) || 0,
      rateLimitCost: parseInt(data.rateLimitCost) || 0,

      // Cost limits
      dailyCostLimit: parseFloat(data.dailyCostLimit) || 0,
      totalCostLimit: parseFloat(data.totalCostLimit) || 0,
      weeklyOpusCostLimit: parseFloat(data.weeklyOpusCostLimit) || 0,

      // User association
      userId: data.userId || undefined,
      userUsername: data.userUsername || undefined,
      createdBy: data.createdBy || 'admin',

      // Other
      tags: data.tags ? JSON.parse(data.tags) : [],
      icon: data.icon || undefined
    }
  }

  /**
   * Convert ApiKey (business format) to ApiKeyData (Redis format)
   */
  private toApiKeyData(key: Partial<ApiKey> & { id: string; apiKey: string }): ApiKeyData {
    return {
      id: key.id,
      name: key.name || '',
      description: key.description || '',
      apiKey: key.apiKey,
      createdAt: key.createdAt || new Date().toISOString(),
      updatedAt: key.updatedAt,
      lastUsedAt: key.lastUsedAt || '',

      // Status
      isActive: (key.isActive ?? true) ? 'true' : 'false',
      isDeleted: (key.isDeleted ?? false) ? 'true' : 'false',
      deletedAt: key.deletedAt,
      deletedBy: key.deletedBy,
      deletedByType: key.deletedByType,
      restoredAt: key.restoredAt,
      restoredBy: key.restoredBy,
      restoredByType: key.restoredByType,

      // Expiration
      expiresAt: key.expiresAt || '',
      expirationMode: key.expirationMode || 'fixed',
      isActivated: (key.isActivated ?? false) ? 'true' : 'false',
      activatedAt: key.activatedAt || '',
      activationDays: (key.activationDays ?? 0).toString(),
      activationUnit: key.activationUnit || 'days',

      // Account binding
      claudeConsoleAccountId: key.claudeConsoleAccountId || '',
      codexAccountId: key.codexAccountId || '',

      // Permissions
      permissions: key.permissions || 'all',
      enableModelRestriction: (key.enableModelRestriction ?? false) ? 'true' : 'false',
      restrictedModels: JSON.stringify(key.restrictedModels || []),
      enableClientRestriction: (key.enableClientRestriction ?? false) ? 'true' : 'false',
      allowedClients: JSON.stringify(key.allowedClients || []),

      // Rate limits
      tokenLimit: (key.tokenLimit ?? 0).toString(),
      concurrencyLimit: (key.concurrencyLimit ?? 0).toString(),
      rateLimitWindow: (key.rateLimitWindow ?? 0).toString(),
      rateLimitRequests: (key.rateLimitRequests ?? 0).toString(),
      rateLimitCost: (key.rateLimitCost ?? 0).toString(),

      // Cost limits
      dailyCostLimit: (key.dailyCostLimit ?? 0).toString(),
      totalCostLimit: (key.totalCostLimit ?? 0).toString(),
      weeklyOpusCostLimit: (key.weeklyOpusCostLimit ?? 0).toString(),

      // User association
      userId: key.userId || '',
      userUsername: key.userUsername || '',
      createdBy: key.createdBy || 'admin',

      // Other
      tags: JSON.stringify(key.tags || []),
      icon: key.icon || ''
    }
  }

  /**
   * Create a new API Key
   */
  async createApiKey(options: CreateApiKeyOptions = {}): Promise<{ key: ApiKey; rawKey: string }> {
    try {
      const keyId = randomBytes(8).toString('hex')
      const rawKey = this.generateApiKeyString()
      const hashedKey = this.hashApiKey(rawKey)

      const now = new Date().toISOString()

      const apiKey: Partial<ApiKey> & { id: string; apiKey: string } = {
        id: keyId,
        apiKey: hashedKey,
        name: options.name || `API Key ${keyId}`,
        description: options.description || '',
        createdAt: now,
        lastUsedAt: '',

        // Status
        isActive: options.isActive ?? true,
        isDeleted: false,

        // Expiration
        expiresAt: options.expiresAt || undefined,
        expirationMode: options.expirationMode || 'fixed',
        isActivated: false,
        activationDays: options.activationDays || 0,
        activationUnit: options.activationUnit || 'days',

        // Account binding
        claudeConsoleAccountId: options.claudeConsoleAccountId || undefined,
        codexAccountId: options.codexAccountId || undefined,

        // Permissions
        permissions: options.permissions || 'all',
        enableModelRestriction: options.enableModelRestriction ?? false,
        restrictedModels: options.restrictedModels || [],
        enableClientRestriction: options.enableClientRestriction ?? false,
        allowedClients: options.allowedClients || [],

        // Rate limits
        tokenLimit: config.DEFAULT_TOKEN_LIMIT,
        concurrencyLimit: options.concurrencyLimit || 0,
        rateLimitWindow: options.rateLimitWindow || 0,
        rateLimitRequests: options.rateLimitRequests || 0,
        rateLimitCost: options.rateLimitCost || 0,

        // Cost limits
        dailyCostLimit: options.dailyCostLimit || 0,
        totalCostLimit: options.totalCostLimit || 0,
        weeklyOpusCostLimit: options.weeklyOpusCostLimit || 0,

        // User association
        userId: options.userId,
        userUsername: options.userUsername,
        createdBy: options.createdBy || 'admin',

        // Other
        tags: options.tags || [],
        icon: options.icon
      }

      const keyData = this.toApiKeyData(apiKey)
      await this.apiKeyRepo.save(keyId, keyData, hashedKey)

      logger.info({ keyId, name: apiKey.name }, 'API Key created')

      // Re-fetch from repository to ensure proper format
      const savedKeyData = await this.apiKeyRepo.findById(keyId)
      if (!savedKeyData) {
        throw new Error('Failed to retrieve created API Key')
      }

      logger.debug({ savedKeyData }, 'Saved key data from repository')
      const parsedKey = this.parseApiKeyData(savedKeyData)
      logger.debug({ parsedKey }, 'Parsed key data')

      return {
        key: parsedKey,
        rawKey
      }
    } catch (error) {
      logger.error({ error, options }, 'Failed to create API Key')
      throw error
    }
  }

  /**
   * Get API Key by ID
   */
  async getApiKey(keyId: string): Promise<ApiKey | null> {
    try {
      const keyData = await this.apiKeyRepo.findById(keyId)

      if (!keyData) {
        return null
      }

      return this.parseApiKeyData(keyData)
    } catch (error) {
      logger.error({ error, keyId }, 'Failed to get API Key')
      throw error
    }
  }

  /**
   * List API Keys with optional filters
   */
  async listApiKeys(options: {
    includeDeleted?: boolean
    isActive?: boolean
    permissions?: 'all' | 'claude' | 'codex'
  } = {}): Promise<ApiKey[]> {
    try {
      const allKeys = await this.apiKeyRepo.findAll()

      let filtered = allKeys.map((data) => this.parseApiKeyData(data))

      // Filter deleted
      if (!options.includeDeleted) {
        filtered = filtered.filter((key) => !key.isDeleted)
      }

      // Filter by active status
      if (options.isActive !== undefined) {
        filtered = filtered.filter((key) => key.isActive === options.isActive)
      }

      // Filter by permissions
      if (options.permissions) {
        filtered = filtered.filter((key) => key.permissions === options.permissions)
      }

      // Sort by creation date (newest first)
      filtered.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      return filtered
    } catch (error) {
      logger.error({ error, options }, 'Failed to list API Keys')
      throw error
    }
  }

  /**
   * Update API Key
   */
  async updateApiKey(keyId: string, updates: UpdateApiKeyOptions): Promise<ApiKey> {
    try {
      const existing = await this.apiKeyRepo.findById(keyId)

      if (!existing) {
        throw new Error('API Key not found')
      }

      const parsed = this.parseApiKeyData(existing)

      if (parsed.isDeleted) {
        throw new Error('Cannot update deleted API Key')
      }

      const updatedFields: Partial<ApiKeyData> = {}

      // Basic fields
      if (updates.name !== undefined) updatedFields.name = updates.name
      if (updates.description !== undefined) updatedFields.description = updates.description
      if (updates.isActive !== undefined) updatedFields.isActive = updates.isActive ? 'true' : 'false'

      // Expiration
      if (updates.expiresAt !== undefined) updatedFields.expiresAt = updates.expiresAt || ''
      if (updates.expirationMode !== undefined) updatedFields.expirationMode = updates.expirationMode
      if (updates.activationDays !== undefined) updatedFields.activationDays = updates.activationDays.toString()
      if (updates.activationUnit !== undefined) updatedFields.activationUnit = updates.activationUnit
      if (updates.isActivated !== undefined) updatedFields.isActivated = updates.isActivated ? 'true' : 'false'
      if (updates.activatedAt !== undefined) updatedFields.activatedAt = updates.activatedAt

      // Account binding
      if (updates.claudeConsoleAccountId !== undefined) {
        updatedFields.claudeConsoleAccountId = updates.claudeConsoleAccountId || ''
      }
      if (updates.codexAccountId !== undefined) {
        updatedFields.codexAccountId = updates.codexAccountId || ''
      }

      // Permissions
      if (updates.permissions !== undefined) updatedFields.permissions = updates.permissions
      if (updates.enableModelRestriction !== undefined) {
        updatedFields.enableModelRestriction = updates.enableModelRestriction ? 'true' : 'false'
      }
      if (updates.restrictedModels !== undefined) {
        updatedFields.restrictedModels = JSON.stringify(updates.restrictedModels)
      }
      if (updates.enableClientRestriction !== undefined) {
        updatedFields.enableClientRestriction = updates.enableClientRestriction ? 'true' : 'false'
      }
      if (updates.allowedClients !== undefined) {
        updatedFields.allowedClients = JSON.stringify(updates.allowedClients)
      }

      // Rate limits
      if (updates.concurrencyLimit !== undefined) {
        updatedFields.concurrencyLimit = updates.concurrencyLimit.toString()
      }
      if (updates.rateLimitWindow !== undefined) {
        updatedFields.rateLimitWindow = updates.rateLimitWindow.toString()
      }
      if (updates.rateLimitRequests !== undefined) {
        updatedFields.rateLimitRequests = updates.rateLimitRequests.toString()
      }
      if (updates.rateLimitCost !== undefined) {
        updatedFields.rateLimitCost = updates.rateLimitCost.toString()
      }

      // Cost limits
      if (updates.dailyCostLimit !== undefined) {
        updatedFields.dailyCostLimit = updates.dailyCostLimit.toString()
      }
      if (updates.totalCostLimit !== undefined) {
        updatedFields.totalCostLimit = updates.totalCostLimit.toString()
      }
      if (updates.weeklyOpusCostLimit !== undefined) {
        updatedFields.weeklyOpusCostLimit = updates.weeklyOpusCostLimit.toString()
      }

      // Other
      if (updates.tags !== undefined) updatedFields.tags = JSON.stringify(updates.tags)
      if (updates.icon !== undefined) updatedFields.icon = updates.icon

      updatedFields.updatedAt = new Date().toISOString()

      await this.apiKeyRepo.update(keyId, updatedFields)

      const updated = await this.apiKeyRepo.findById(keyId)
      logger.info({ keyId, fields: Object.keys(updatedFields) }, 'API Key updated')

      return this.parseApiKeyData(updated!)
    } catch (error) {
      logger.error({ error, keyId, updates }, 'Failed to update API Key')
      throw error
    }
  }

  /**
   * Soft delete API Key
   */
  async deleteApiKey(keyId: string, deletedBy: string = 'admin'): Promise<void> {
    try {
      const existing = await this.apiKeyRepo.findById(keyId)

      if (!existing) {
        throw new Error('API Key not found')
      }

      const parsed = this.parseApiKeyData(existing)

      if (parsed.isDeleted) {
        throw new Error('API Key already deleted')
      }

      const updates: Partial<ApiKeyData> = {
        isDeleted: 'true',
        deletedAt: new Date().toISOString(),
        deletedBy,
        deletedByType: 'admin',
        isActive: 'false'
      }

      await this.apiKeyRepo.update(keyId, updates)

      logger.info({ keyId, deletedBy }, 'API Key soft deleted')
    } catch (error) {
      logger.error({ error, keyId, deletedBy }, 'Failed to delete API Key')
      throw error
    }
  }

  /**
   * Restore deleted API Key
   */
  async restoreApiKey(keyId: string, restoredBy: string = 'admin'): Promise<ApiKey> {
    try {
      const existing = await this.apiKeyRepo.findById(keyId)

      if (!existing) {
        throw new Error('API Key not found')
      }

      const parsed = this.parseApiKeyData(existing)

      if (!parsed.isDeleted) {
        throw new Error('API Key is not deleted')
      }

      const updates: Partial<ApiKeyData> = {
        isDeleted: 'false',
        restoredAt: new Date().toISOString(),
        restoredBy,
        restoredByType: 'admin',
        deletedAt: '',
        deletedBy: '',
        deletedByType: ''
      }

      await this.apiKeyRepo.update(keyId, updates)

      const restored = await this.apiKeyRepo.findById(keyId)
      logger.info({ keyId, restoredBy }, 'API Key restored')

      return this.parseApiKeyData(restored!)
    } catch (error) {
      logger.error({ error, keyId, restoredBy }, 'Failed to restore API Key')
      throw error
    }
  }

  /**
   * Get API Key usage statistics
   */
  async getApiKeyStats(keyId: string): Promise<{
    total: {
      requests: number
      tokens: number
      allTokens: number
      inputTokens: number
      outputTokens: number
      cacheCreateTokens: number
      cacheReadTokens: number
      cost?: number
    }
    daily?: any
    monthly?: any
  }> {
    try {
      const stats = await this.usageRepo.getStats(keyId)
      return stats
    } catch (error) {
      logger.error({ error, keyId }, 'Failed to get API Key stats')
      throw error
    }
  }
}
