import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  client.$use(async (params, next) => {
    if (params.model === 'User') {
      if (params.action === 'delete') {
        const user = await client.user.findUnique({ where: params.args.where });
        if (user && ['SUPER_ADMIN', 'GUARD'].includes(user.role)) {
          console.log('BLOCKED: Cannot delete system user', user.phone);
          return user;
        }
      }
      if (params.action === 'deleteMany') {
        if (!params.args?.where) {
          params.args = { where: {} };
        }
        params.args.where.role = { notIn: ['SUPER_ADMIN', 'GUARD'] };
      }
    }
    return next(params);
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
