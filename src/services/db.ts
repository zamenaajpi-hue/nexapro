import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    try {
      prisma = new PrismaClient({
        log: ['error', 'warn'],
      });
    } catch (error: any) {
      console.error("\n============================= PRISMA ERROR =============================");
      console.error("❌ НЕ УДАЛОСЬ ИНИЦИАЛИЗИРОВАТЬ DATABASE CLIENT!");
      console.error("👉 Решение: Запустите генерацию Prisma Client в терминале вашего проекта:");
      console.error("   npx prisma generate");
      console.error("========================================================================\n");
      throw error;
    }
  }
  return prisma;
}

// Использование Proxy предотвращает падение при импорте модуля, если Prisma Client еще не сгенерирован.
// База данных будет инициализирована при первом обращении к её свойствам/методам.
export const db = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    try {
      const client = getPrisma();
      const value = Reflect.get(client, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(client);
      }
      return value;
    } catch (err) {
      console.error("\n❌ Ошибка при обращении к базе данных. Убедитесь, что вы запустили 'npx prisma generate'.\n");
      throw err;
    }
  }
});

