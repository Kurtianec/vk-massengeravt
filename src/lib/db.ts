import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Lazy singleton — only create when actually needed, not on import
function createPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  const client = new PrismaClient({
    log: process.env.PRISMA_LOG === '1' ? ['query'] : ['error'],
  })

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
  return client
}

// Export a getter so PrismaClient is only created when first accessed
// This prevents crashes if DATABASE_URL is missing during module loading
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = createPrismaClient()
    const value = (client as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})
