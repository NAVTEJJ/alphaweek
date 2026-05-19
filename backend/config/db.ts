import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { logger } from '../src/utils/logger';
import ws from 'ws';

// Use WebSockets so Neon works over port 443 (bypasses firewall blocking port 5432)
neonConfig.webSocketConstructor = ws;

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function verifyDatabaseConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Prisma connected to Neon PostgreSQL (WebSocket)');
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
