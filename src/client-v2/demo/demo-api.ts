// Адаптер API в памяти браузера для прототипа: форма объекта `api` из старого клиента,
// но без сети. Состояние живёт в экземпляре, перезагрузка страницы возвращает исходные данные.

import { ApiError, type api } from '../../client/api';
import { createDemoData, type DemoData } from './demo-data';

export type DemoApiOptions = {
  // Часы передаются снаружи: даты демо-данных и действий считаются только от них
  now?: () => Date;
  // Сценарий «Пусто»: списки без записей
  empty?: boolean;
  // Сценарий «Сбой»: списки отклоняются обычной ошибкой, как недоступный сервер
  failLists?: boolean;
};

export function createDemoApi(options: DemoApiOptions = {}): typeof api {
  const { now = () => new Date(), empty = false, failLists = false } = options;

  const state: DemoData = empty ? { books: [], readers: [], loans: [] } : createDemoData(now());

  // Списки возвращают копии: вызывающий код не меняет состояние адаптера
  function list<T>(items: readonly T[]): Promise<T[]> {
    if (failLists) return Promise.reject(new Error('demo api: lists are failing'));
    return Promise.resolve(items.map((item) => ({ ...item })));
  }

  // Действия появятся после решения автора, откуда адаптер берёт правила выдачи
  function notImplemented(): Promise<never> {
    return Promise.reject(new ApiError('INTERNAL_ERROR'));
  }

  return {
    listBooks: () => list(state.books),
    addBook: notImplemented,
    listReaders: () => list(state.readers),
    addReader: notImplemented,
    listLoans: () => list(state.loans),
    checkout: notImplemented,
    returnLoan: notImplemented,
  };
}
