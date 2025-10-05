import { scrypt, randomBytes, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

const SALT_LENGTH = 16
const KEY_LENGTH = 64

/**
 * Hash a password using scrypt
 * @param password - Plain text password
 * @returns Hash in format: salt.hash (hex encoded)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer

  return `${salt.toString('hex')}.${derivedKey.toString('hex')}`
}

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param storedHash - Hash in format: salt.hash
 * @returns True if password matches
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, keyHex] = storedHash.split('.')

  if (!saltHex || !keyHex) {
    throw new Error('Invalid password hash format')
  }

  const salt = Buffer.from(saltHex, 'hex')
  const storedKey = Buffer.from(keyHex, 'hex')

  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer

  return timingSafeEqual(storedKey, derivedKey)
}

/**
 * Generate a random password
 * @param length - Password length (default: 20)
 * @returns Random password with alphanumeric and special characters
 */
export function generatePassword(length: number = 20): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const password: string[] = []

  // Ensure at least one of each type
  password.push('A') // uppercase
  password.push('a') // lowercase
  password.push('0') // digit
  password.push('!') // special

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    const randomIndex = randomBytes(1)[0] % charset.length
    password.push(charset[randomIndex])
  }

  // Shuffle the password
  for (let i = password.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1)
    ;[password[i], password[j]] = [password[j], password[i]]
  }

  return password.join('')
}
