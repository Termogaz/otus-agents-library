// Учётки для e2e. Создаются только в тестовой базе library_test (tests/e2e/global-setup.ts),
// на чужой стенд (VPS, контейнер) фикстурные пароли не попадают: для него задаются
// переменные E2E_LIBRARIAN_LOGIN, E2E_LIBRARIAN_PASSWORD, E2E_READER_LOGIN, E2E_READER_PASSWORD.
export const accounts = {
  librarian: {
    login: process.env['E2E_LIBRARIAN_LOGIN'] ?? 'e2e-librarian',
    password: process.env['E2E_LIBRARIAN_PASSWORD'] ?? 'e2e-librarian-password-1',
  },
  reader: {
    login: process.env['E2E_READER_LOGIN'] ?? 'e2e-reader',
    password: process.env['E2E_READER_PASSWORD'] ?? 'e2e-reader-password-1',
    // Читатель, к которому привязана учётка; создаётся в global-setup
    readerId: 'e2e-reader-1',
    readerName: 'Читатель E2E',
  },
} as const;
