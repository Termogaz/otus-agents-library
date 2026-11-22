import { z } from 'zod';

export type AppConfig = {
  storage: 'json' | 'postgres';
  // Задана только при storage === 'postgres'
  databaseUrl?: string;
  port: number;
  dataFile: string;
  nodeEnv?: string;
};

const envSchema = z
  .object({
    STORAGE: z.enum(['json', 'postgres']).default('json'),
    DATABASE_URL: z.string().min(1).optional(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LIBRARY_DATA_FILE: z.string().min(1).default('data/library.json'),
    NODE_ENV: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE === 'postgres' && !env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'обязательна при STORAGE=postgres',
      });
    }
    if (env.NODE_ENV === 'production' && env.STORAGE !== 'postgres') {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE'],
        message: 'в production нужен STORAGE=postgres: без него нет входа и RLS',
      });
    }
  });

// Разбирает переменные окружения. Ошибка перечисляет поля и причины, но не значения
// переменных: среди них строка подключения с паролем.
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`,
    );
    throw new Error(`Неверная конфигурация сервера:\n${lines.join('\n')}`);
  }
  const data = result.data;
  return {
    storage: data.STORAGE,
    ...(data.STORAGE === 'postgres' && data.DATABASE_URL ? { databaseUrl: data.DATABASE_URL } : {}),
    port: data.PORT,
    dataFile: data.LIBRARY_DATA_FILE,
    ...(data.NODE_ENV === undefined ? {} : { nodeEnv: data.NODE_ENV }),
  };
}
