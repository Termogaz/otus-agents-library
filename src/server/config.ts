import { z } from 'zod';

export type AppConfig = {
  storage: 'json' | 'postgres';
  // Задана только при storage === 'postgres'
  databaseUrl?: string;
  port: number;
  dataFile: string;
  nodeEnv?: string;
  // Разрешённые источники CORS и записи (D-10): только origin без пути, звёздочки нет
  corsAllowedOrigins: ReadonlySet<string>;
  // Число доверенных прокси перед Express (0 — прокси нет); от него зависят req.secure и req.ip
  trustProxy: number;
  // Настройки AI (D-14). Ключ только из окружения сервера; без него маршрут отвечает 503
  ai: { apiKey?: string; model: string; dailyLimit: number };
};

// Список origin через запятую. Каждый элемент обязан быть ровно origin (схема, хост, порт):
// путь, слэш в конце и звёздочка отклоняются. Значения в сообщение не попадают.
const originList = z
  .string()
  .default('')
  .transform((value, ctx) => {
    const origins = new Set<string>();
    for (const item of value.split(',').map((part) => part.trim())) {
      if (item === '') continue;
      let normalized: string | undefined;
      try {
        normalized = new URL(item).origin;
      } catch {
        normalized = undefined;
      }
      if (normalized !== item) {
        ctx.addIssue({
          code: 'custom',
          message: 'каждый элемент — origin вида https://host[:порт] без пути и без звёздочки',
        });
        return z.NEVER;
      }
      origins.add(item);
    }
    return origins;
  });

const envSchema = z
  .object({
    STORAGE: z.enum(['json', 'postgres']).default('json'),
    DATABASE_URL: z.string().min(1).optional(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LIBRARY_DATA_FILE: z.string().min(1).default('data/library.json'),
    NODE_ENV: z.string().optional(),
    CORS_ALLOWED_ORIGINS: originList,
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    // Пустая строка или пробелы — ключа нет
    DEEPSEEK_API_KEY: z
      .string()
      .optional()
      .transform((value) => value?.trim() || undefined),
    // Имя модели меняется без правки кода; пустое значение — модель по умолчанию
    DEEPSEEK_MODEL: z
      .string()
      .optional()
      .transform((value) => value?.trim() || 'deepseek-flash'),
    AI_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(20),
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
    corsAllowedOrigins: data.CORS_ALLOWED_ORIGINS,
    trustProxy: data.TRUST_PROXY,
    ai: {
      ...(data.DEEPSEEK_API_KEY === undefined ? {} : { apiKey: data.DEEPSEEK_API_KEY }),
      model: data.DEEPSEEK_MODEL,
      dailyLimit: data.AI_DAILY_LIMIT,
    },
    ...(data.NODE_ENV === undefined ? {} : { nodeEnv: data.NODE_ENV }),
  };
}
