# Спека API

Письменная спека HTTP API библиотеки (ДЗ-5, фаза 8). Написана до кода (D-08): маршруты, роли,
коды успеха и ошибок отсюда читают тесты через парсер
[`tests/support/api-spec.ts`](../tests/support/api-spec.ts) — матрица доступа и CRUD-тесты
берут перечень маршрутов из этого файла, а не из кода. Таблицы «Маршруты» и «Коды ошибок»
разбираются машинно: формат заголовков и ячеек менять нельзя.

## Общее

- **Формат ошибки.** Любой отказ — JSON `{ code, details? }`; `code` — строка из таблицы
  «Коды ошибок», `details` — необязательные подробности (для `VALIDATION_ERROR` — ошибки по полям).
- **Тела.** Запросы и ответы — JSON (`Content-Type: application/json`). Даты — строки ISO 8601.
  Идентификаторы книг, читателей и выдач — строки; идентификатор учётки — UUID.
- **Сессия.** После входа сервер ставит cookie `library_session`: `httpOnly`, `SameSite=Lax`,
  `Secure` на HTTPS, `Path=/`, срок 7 дней (D-05). В cookie лежит случайный токен, в БД — только его
  sha256. Новый токен выдаётся на каждый вход.
- **Роли (D-04).** `anon` — запрос без действующей сессии; `reader` — читатель: смотрит каталог и
  свои выдачи; `librarian` — библиотекарь: полный доступ. Запись (`POST`, `PATCH`, `DELETE`, кроме
  входа и выхода) разрешена только `librarian`.
- **Режим `STORAGE=json`.** Без входа: каждый запрос выполняется от имени системного
  библиотекаря, маршруты входа и выхода не подключены, `GET /api/auth/me` отвечает
  `{ "login": null, "role": "librarian", "readerId": null, "readerName": null }`.
  Сбой файла данных в этом режиме — `500 STORAGE_ERROR`.

## Маршруты

В колонке «Ошибки» — пары `код_HTTP КОД` через запятую. Общие для всех не-anon маршрутов отказы
в строки не повторяются — они перечислены в разделе «Общие ошибки».

| Метод  | Путь                    | Роли                    | Успех | Ошибки                                                                                                                  |
| ------ | ----------------------- | ----------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`           | anon, reader, librarian | 200   |                                                                                                                         |
| POST   | `/api/auth/login`       | anon                    | 200   | 400 VALIDATION_ERROR, 401 INVALID_CREDENTIALS, 429 TOO_MANY_ATTEMPTS                                                    |
| POST   | `/api/auth/logout`      | reader, librarian       | 204   |                                                                                                                         |
| GET    | `/api/auth/me`          | reader, librarian       | 200   | 401 UNAUTHENTICATED                                                                                                     |
| POST   | `/api/users`            | librarian               | 201   | 400 VALIDATION_ERROR, 404 READER_NOT_FOUND, 409 LOGIN_TAKEN, 409 READER_ALREADY_HAS_ACCOUNT                             |
| GET    | `/api/books`            | reader, librarian       | 200   |                                                                                                                         |
| POST   | `/api/books`            | librarian               | 201   | 400 VALIDATION_ERROR                                                                                                    |
| GET    | `/api/books/:id`        | reader, librarian       | 200   | 404 BOOK_NOT_FOUND                                                                                                      |
| PATCH  | `/api/books/:id`        | librarian               | 200   | 400 VALIDATION_ERROR, 404 BOOK_NOT_FOUND, 409 COPIES_BELOW_ACTIVE_LOANS                                                 |
| DELETE | `/api/books/:id`        | librarian               | 204   | 404 BOOK_NOT_FOUND, 409 BOOK_HAS_ACTIVE_LOANS, 409 BOOK_HAS_LOAN_HISTORY                                                |
| GET    | `/api/readers`          | librarian               | 200   |                                                                                                                         |
| POST   | `/api/readers`          | librarian               | 201   | 400 VALIDATION_ERROR                                                                                                    |
| GET    | `/api/readers/:id`      | librarian               | 200   | 404 READER_NOT_FOUND                                                                                                    |
| PATCH  | `/api/readers/:id`      | librarian               | 200   | 400 VALIDATION_ERROR, 404 READER_NOT_FOUND                                                                              |
| DELETE | `/api/readers/:id`      | librarian               | 204   | 404 READER_NOT_FOUND, 409 READER_HAS_ACTIVE_LOANS, 409 READER_HAS_LOAN_HISTORY                                          |
| GET    | `/api/loans`            | reader, librarian       | 200   | 400 VALIDATION_ERROR                                                                                                    |
| POST   | `/api/loans`            | librarian               | 201   | 400 VALIDATION_ERROR, 404 BOOK_NOT_FOUND, 404 READER_NOT_FOUND, 409 NO_FREE_COPIES, 409 LOAN_LIMIT_REACHED              |
| POST   | `/api/loans/:id/return` | librarian               | 200   | 404 LOAN_NOT_FOUND, 409 LOAN_ALREADY_RETURNED                                                                           |
| POST   | `/api/ai/book-draft`    | librarian               | 200   | 400 VALIDATION_ERROR, 429 AI_LIMIT_REACHED, 502 AI_UPSTREAM_ERROR, 502 AI_BAD_RESPONSE, 503 AI_DISABLED, 504 AI_TIMEOUT |

Бизнес-сценарий — выдача книги (`POST /api/loans`): правило (есть свободный экземпляр, не
превышен лимит читателя) живёт в `src/domain`, в Postgres выдача идёт в одной транзакции с
блокировками строк (см. «Схему данных» в [`architecture.md`](architecture.md)).

### Общие ошибки

Для каждого маршрута, кроме `anon`-маршрутов, возможны (в строках таблицы не повторяются):

- `401 UNAUTHENTICATED` — нет сессии или она истекла;
- `403 FORBIDDEN` — роль вошедшего не входит в колонку «Роли» маршрута;
- `403 ORIGIN_NOT_ALLOWED` — запись (`POST`, `PATCH`, `DELETE`) с чужим `Origin`;
- `500 INTERNAL_ERROR` — непредвиденный сбой;
- `503 DB_BUSY` — база заблокирована дольше таймаута; `503 DB_UNAVAILABLE` — база недоступна.

Тело, не являющееся JSON, на любом маршруте с телом — `400 INVALID_JSON`; неизвестный путь —
`404 NOT_FOUND`.

## Тела запросов и ответов

Поля с `?` необязательны.

**Книга.** `{ id, title, author, isbn, copies, available }`, где `copies` — всего экземпляров
(целое ≥ 1), `available` — свободных сейчас.

**Читатель.** `{ id, name, contact }`.

**Выдача.** `{ id, bookId, readerId, issuedAt, dueAt, returnedAt, overdue }`; `returnedAt` — `null`,
пока книга у читателя; `overdue` — вычисляется на момент запроса.

| Маршрут                      | Запрос                                                   | Ответ                                                             |
| ---------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET /api/health`            | —                                                        | `{ status: 'ok' }`                                                |
| `POST /api/auth/login`       | `{ login, password }`                                    | `{ login, role, readerId, readerName }`, ставит cookie            |
| `POST /api/auth/logout`      | —                                                        | пустое тело, cookie очищается                                     |
| `GET /api/auth/me`           | —                                                        | `{ login, role, readerId, readerName }`                           |
| `POST /api/users`            | `{ login, password, role, readerId? }`                   | `{ id, login, role, readerId }` (без пароля и хеша)               |
| `GET /api/books`             | —                                                        | массив книг                                                       |
| `POST /api/books`            | `{ title, author, isbn, copies }`                        | книга                                                             |
| `GET /api/books/:id`         | —                                                        | книга                                                             |
| `PATCH /api/books/:id`       | `{ title?, author?, isbn?, copies? }`, хотя бы одно поле | книга                                                             |
| `DELETE /api/books/:id`      | —                                                        | пустое тело                                                       |
| `GET /api/readers`           | —                                                        | массив читателей                                                  |
| `POST /api/readers`          | `{ name, contact }`                                      | читатель                                                          |
| `GET /api/readers/:id`       | —                                                        | читатель                                                          |
| `PATCH /api/readers/:id`     | `{ name?, contact? }`, хотя бы одно поле                 | читатель                                                          |
| `DELETE /api/readers/:id`    | —                                                        | пустое тело                                                       |
| `GET /api/loans`             | query `bookId?`, `readerId?`                             | массив выдач                                                      |
| `POST /api/loans`            | `{ bookId, readerId }`                                   | выдача                                                            |
| `POST /api/loans/:id/return` | —                                                        | выдача с заполненным `returnedAt`                                 |
| `POST /api/ai/book-draft`    | `{ text }`, 1–2000 символов                              | `{ title, author, isbn, copies }` — черновик, в БД не сохраняется |

Правила полей:

- **Вход.** `login` — 3–64 символа из `[a-z0-9._-]` после приведения к нижнему регистру;
  `password` — 12–128 символов.
- **`POST /api/users`.** `role` — `librarian` или `reader`; `readerId` обязателен для `reader` и
  запрещён для `librarian`; у читателя не больше одной учётки.
- **`GET /api/loans` для читателя** возвращает только его выдачи (фильтр RLS, D-06): чужие строки
  недоступны на уровне БД, а не только в коде маршрута.
- **`PATCH /api/books/:id`:** уменьшить `copies` ниже числа активных выдач нельзя —
  `409 COPIES_BELOW_ACTIVE_LOANS`.
- **Удаление.** Книгу или читателя с активной выдачей удалить нельзя (`*_HAS_ACTIVE_LOANS`);
  с закрытыми выдачами — тоже (`*_HAS_LOAN_HISTORY`): история не теряется.
- **Черновик AI.** Только предлагает значения полей книги; сохранение — отдельным `POST /api/books`
  после проверки человеком.

## Коды ошибок

| Код                          | HTTP | Когда                                                               | Текст в UI                                           |
| ---------------------------- | ---- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| `VALIDATION_ERROR`           | 400  | тело, query или параметры не прошли проверку zod                    | Проверьте поля: данные заполнены неверно             |
| `INVALID_JSON`               | 400  | тело запроса не является JSON                                       | Запрос отправлен в неверном формате                  |
| `UNAUTHENTICATED`            | 401  | нет сессии или она истекла                                          | Войдите, чтобы продолжить                            |
| `INVALID_CREDENTIALS`        | 401  | неверный логин или пароль (ответ один и тот же для обоих)           | Неверный логин или пароль                            |
| `FORBIDDEN`                  | 403  | роль вошедшего не позволяет это действие                            | У вас нет прав на это действие                       |
| `ORIGIN_NOT_ALLOWED`         | 403  | запись с `Origin`, которого нет в списке разрешённых                | Запрос отклонён: неизвестный источник                |
| `BOOK_NOT_FOUND`             | 404  | книги с таким id нет                                                | Книга не найдена                                     |
| `READER_NOT_FOUND`           | 404  | читателя с таким id нет                                             | Читатель не найден                                   |
| `LOAN_NOT_FOUND`             | 404  | выдачи с таким id нет                                               | Выдача не найдена                                    |
| `NOT_FOUND`                  | 404  | неизвестный путь                                                    | Страница или адрес не найдены                        |
| `NO_FREE_COPIES`             | 409  | свободных экземпляров книги нет                                     | Свободных экземпляров нет                            |
| `LOAN_LIMIT_REACHED`         | 409  | у читателя уже максимум книг на руках                               | Читатель достиг лимита книг                          |
| `LOAN_ALREADY_RETURNED`      | 409  | выдача уже закрыта                                                  | Книга уже возвращена                                 |
| `BOOK_HAS_ACTIVE_LOANS`      | 409  | удаление книги, которая сейчас у читателей                          | Книгу нельзя удалить: она на руках у читателя        |
| `BOOK_HAS_LOAN_HISTORY`      | 409  | удаление книги с закрытыми выдачами                                 | Книгу нельзя удалить: по ней есть история выдач      |
| `READER_HAS_ACTIVE_LOANS`    | 409  | удаление читателя с книгами на руках                                | Читателя нельзя удалить: у него есть книги на руках  |
| `READER_HAS_LOAN_HISTORY`    | 409  | удаление читателя с закрытыми выдачами                              | Читателя нельзя удалить: у него есть история выдач   |
| `COPIES_BELOW_ACTIVE_LOANS`  | 409  | новое число экземпляров меньше числа активных выдач                 | Экземпляров не может быть меньше, чем выдано         |
| `LOGIN_TAKEN`                | 409  | логин уже занят                                                     | Этот логин уже занят                                 |
| `READER_ALREADY_HAS_ACCOUNT` | 409  | у читателя уже есть учётная запись                                  | У этого читателя уже есть учётная запись             |
| `CONFLICT`                   | 409  | конфликт записи, не покрытый кодами выше (нарушение ограничения БД) | Данные изменились, обновите страницу и повторите     |
| `TOO_MANY_ATTEMPTS`          | 429  | слишком много неудачных входов подряд                               | Слишком много попыток входа, подождите и повторите   |
| `AI_LIMIT_REACHED`           | 429  | исчерпан дневной лимит запросов к AI                                | Дневной лимит подсказок AI исчерпан                  |
| `INTERNAL_ERROR`             | 500  | непредвиденный сбой сервера                                         | Что-то пошло не так, повторите позже                 |
| `STORAGE_ERROR`              | 500  | сбой файла данных (только `STORAGE=json`)                           | Не удалось прочитать или записать данные             |
| `AI_UPSTREAM_ERROR`          | 502  | сервис AI ответил ошибкой                                           | Сервис подсказок недоступен, заполните поля вручную  |
| `AI_BAD_RESPONSE`            | 502  | ответ AI не соответствует схеме                                     | AI вернул неподходящий ответ, заполните поля вручную |
| `DB_BUSY`                    | 503  | строка заблокирована дольше таймаута                                | Система занята, повторите через несколько секунд     |
| `DB_UNAVAILABLE`             | 503  | база данных недоступна                                              | База данных недоступна, повторите позже              |
| `AI_DISABLED`                | 503  | AI-фича выключена (нет ключа)                                       | Подсказки AI отключены                               |
| `AI_TIMEOUT`                 | 504  | сервис AI не ответил за отведённое время                            | Сервис подсказок не ответил вовремя                  |

## CORS и Origin

Решение D-10.

- Разрешённые источники задаются переменной `CORS_ALLOWED_ORIGINS` — origin через запятую.
- Для разрешённого `Origin` сервер отвечает `Access-Control-Allow-Origin: <origin>`,
  `Access-Control-Allow-Credentials: true`, `Vary: Origin`. Значение `*` вместе с credentials
  не используется никогда.
- Preflight `OPTIONS` отвечает `204` с `Access-Control-Allow-Methods` и
  `Access-Control-Allow-Headers: Content-Type`.
- Запись (`POST`, `PATCH`, `DELETE`) с `Origin`, которого нет ни в списке, ни среди хоста запроса,
  — `403 ORIGIN_NOT_ALLOWED`. Это дешёвая защита от CSRF поверх `SameSite=Lax`.
