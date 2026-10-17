import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, errorMessage } from '../../src/client/api.js';

// Подменяем fetch: проверяем только разбор ответа клиентом, без сервера
function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return errorMessage(error);
  }
  throw new Error('expected request to fail');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('client api', () => {
  it('shows domain refusal code as russian text', async () => {
    stubFetch(Response.json({ code: 'NO_FREE_COPIES' }, { status: 409 }));

    expect(await messageOf(api.checkout('b1', 'r1'))).toBe('Нет свободных экземпляров');
  });

  it('shows explicit text for internal server error', async () => {
    stubFetch(Response.json({ code: 'INTERNAL_ERROR' }, { status: 500 }));

    expect(await messageOf(api.listBooks())).toBe('Внутренняя ошибка сервера');
  });

  it('treats non-json error response as server error, not as unreachable server', async () => {
    stubFetch(new Response('Bad Gateway', { status: 502 }));

    const promise = api.listBooks();
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    expect(await messageOf(promise)).toBe('Внутренняя ошибка сервера');
  });

  it('reports unreachable server when request fails', async () => {
    stubFetch(new TypeError('fetch failed'));

    expect(await messageOf(api.listBooks())).toBe('Сервер недоступен');
  });

  it('encodes loan id in return path', async () => {
    const fetchMock = stubFetch(Response.json({}, { status: 200 }));

    await api.returnLoan('a/b?c');

    expect(fetchMock).toHaveBeenCalledWith('/api/loans/a%2Fb%3Fc/return', expect.anything());
  });
});
