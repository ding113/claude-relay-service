/**
 * Admin authentication types
 */

export interface AdminCredentials {
  username: string
  passwordHash: string // scrypt hash with salt
  createdAt: number
  updatedAt: number
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  expiresIn: number
}

export interface JWTPayload {
  username: string
  role: 'admin'
}

export interface AuthenticatedUser {
  username: string
  role: 'admin'
}
