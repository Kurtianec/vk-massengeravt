import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let dbError: string | null = null

function createPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  // Check if DATABASE_URL is configured
  if (!process.env.DATABASE_URL) {
    dbError = 'DATABASE_URL не настроен. Добавьте переменную окружения в Vercel Dashboard → Settings → Environment Variables.'
    console.error(dbError)
    // Return a dummy client that will throw with a helpful message
    throw new Error(dbError)
  }

  const client = new PrismaClient({
    log: process.env.PRISMA_LOG === '1' ? ['query'] : ['error'],
  })

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
  return client
}

// Safe DB wrapper — catches connection errors and returns null instead of crashing
export async function safeDbQuery<T>(query: (db: PrismaClient) => Promise<T>): Promise<T | null> {
  try {
    const client = createPrismaClient()
    return await query(client)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'DB error'
    console.error('Database query failed:', msg)
    return null
  }
}

export function getDbError(): string | null {
  return dbError
}

// Export db as a lazy proxy
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    try {
      const client = createPrismaClient()
      const value = (client as Record<string | symbol, unknown>)[prop]
      if (typeof value === 'function') {
        return value.bind(client)
      }
      return value
    } catch {
      // Return a proxy that throws with helpful message on any access
      return new Proxy(() => {}, {
        apply() {
          throw new Error(dbError || 'База данных недоступна. Настройте DATABASE_URL.')
        },
        get() {
          return new Proxy(() => {}, {
            apply() {
              throw new Error(dbError || 'База данных недоступна. Настройте DATABASE_URL.')
            }
          })
        }
      })
    }
  },
})
