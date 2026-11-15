// Восемь состояний макета для прототипа (ux-patterns.md): хеш страницы выбирает сценарий.
// Три состояния видны сразу после открытия, пять остальных получаются одним кликом:
// прототип остаётся кликабельным и ничего не подставляет без действия пользователя.

import type { DemoApiOptions } from '../demo/demo-api';

export type ScenarioName =
  'work' | 'first' | 'failed' | 'waiting' | 'saved' | 'issued' | 'refusal' | 'returned';

export type Scenario = {
  name: ScenarioName;
  // Подпись ссылки панели
  label: string;
  // Что открыть или нажать, чтобы увидеть состояние
  hint: string;
  // Опции адаптера демо-данных без часов и генератора id: их задаёт страница
  apiOptions: Pick<DemoApiOptions, 'empty' | 'failLists' | 'failListsAfterAction' | 'holdActions'>;
};

// Порядок списка — порядок ссылок на панели
export const SCENARIOS: readonly Scenario[] = [
  {
    name: 'work',
    label: 'Работа',
    hint: 'Рабочее состояние: списки загружены, есть просроченная выдача и книга без свободных экземпляров.',
    apiOptions: {},
  },
  {
    name: 'first',
    label: 'Первый запуск',
    hint: 'Пустой каталог: чтобы выдать книгу, сначала добавьте книгу и читателя в формах ниже.',
    apiOptions: { empty: true },
  },
  {
    name: 'failed',
    label: 'Сбой загрузки',
    hint: 'Данные не загрузились: вверху одно сообщение об ошибке, вместо таблиц сообщение «Данные не загружены».',
    apiOptions: { failLists: true },
  },
  {
    name: 'waiting',
    label: 'Ожидание ответа',
    hint: 'Выберите книгу и читателя и нажмите «Выдать»: ответ не придёт, кнопка останется заблокированной.',
    apiOptions: { holdActions: true },
  },
  {
    name: 'saved',
    label: 'Сохранено без списка',
    hint: 'Выберите книгу и читателя и нажмите «Выдать» (или добавьте книгу): запись пройдёт, а списки не перечитаются.',
    apiOptions: { failListsAfterAction: true },
  },
  {
    name: 'issued',
    label: 'Выдано',
    hint: 'Выберите свободную книгу и читателя и нажмите «Выдать»: появится сообщение со сроком возврата.',
    apiOptions: {},
  },
  {
    name: 'refusal',
    label: 'Отказ',
    hint: 'Выберите «Демо-книга «Единственная»» (свободных экземпляров нет), любого читателя и нажмите «Выдать».',
    apiOptions: {},
  },
  {
    name: 'returned',
    label: 'Возвращено',
    hint: 'Нажмите «Вернуть» в строке любой выдачи: сообщение «Принято» появится над таблицей.',
    apiOptions: {},
  },
];

const WORK = SCENARIOS[0] as Scenario;

// Имя ищется только в фиксированном списке: произвольный хеш не разбирается и не выводится,
// неизвестное значение даёт сценарий `work` (T-07-20)
export function scenarioOptions(hash: string): Scenario {
  const found = SCENARIOS.find((scenario) => `#${scenario.name}` === hash);
  return found ?? WORK;
}
