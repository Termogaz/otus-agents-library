import { z } from 'zod';

// Пределы ввода на границе сервера. Без них обычный ввод клиента доходил до Postgres и падал там
// с 22021 (символ NUL в text) или 22003 (copies вне integer), а клиент получал 500 INTERNAL_ERROR.
export const MAX_TEXT_LENGTH = 500;
export const MAX_COPIES = 10_000;

// Символ NUL Postgres не хранит в text
export const withoutNul = (value: string) => !value.includes('\u0000');

// Непустая строка поля: книга, читатель, id в пути и в query
export const fieldText = z
  .string()
  .trim()
  .min(1)
  .max(MAX_TEXT_LENGTH)
  .refine(withoutNul, 'недопустимый символ');

export const copiesField = z.number().int().min(1).max(MAX_COPIES);
