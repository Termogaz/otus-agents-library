import type pg from 'pg';
import type { RequestContext } from '../storage.js';
import { withRequestContext } from './postgres-storage.js';

// Суточный лимит запросов к AI на пользователя
export interface AiQuota {
  // true — запрос засчитан и разрешён, false — лимит на сегодня исчерпан
  take(ctx: RequestContext, limit: number): Promise<boolean>;
}

export class PgAiQuota implements AiQuota {
  constructor(private readonly pool: pg.Pool) {}

  async take(ctx: RequestContext, limit: number): Promise<boolean> {
    // В режиме Postgres вход есть всегда: без пользователя считать нечего
    if (ctx.userId === null) throw new Error('квота AI требует пользователя');
    // Одна короткая транзакция до вызова модели. Атомарный upsert: счётчик растёт только пока
    // он меньше лимита; нет возвращённой строки — лимит исчерпан. Сутки считаются по часовому
    // поясу БД (current_date; в контейнере это UTC).
    return withRequestContext(this.pool, ctx, async (client) => {
      const { rowCount } = await client.query(
        `insert into ai_usage (user_id, day, count) values ($1, current_date, 1)
         on conflict (user_id, day) do update set count = ai_usage.count + 1
         where ai_usage.count < $2
         returning count`,
        [ctx.userId, limit],
      );
      return rowCount === 1;
    });
  }
}
