/**
 * 测试环境设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-32-characters-long-key'
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012' // 32 字符
process.env.REDIS_HOST = 'localhost'
process.env.REDIS_PORT = '6379'
process.env.REDIS_DB = '15' // 使用 DB 15 作为测试数据库
process.env.LOG_LEVEL = 'error' // 测试时只输出错误日志
process.env.TIMEZONE_OFFSET = '8'
