import { describe, expect, it } from 'vitest';
import { ApiError, errorMessage } from '../../src/client/api.js';
import { liveErrorMessage } from '../../src/client-v2/api/live-client.js';
import { loadErrorCodes } from '../support/api-spec.js';

// Коды старого клиента: их тексты заморожены вместе с src/client (D-12) и проверяются другими спеками
const OLD_CODES = [
  'NO_FREE_COPIES',
  'LOAN_LIMIT_REACHED',
  'LOAN_ALREADY_RETURNED',
  'VALIDATION_ERROR',
  'BOOK_NOT_FOUND',
  'READER_NOT_FOUND',
  'LOAN_NOT_FOUND',
  'INTERNAL_ERROR',
];

const spec = loadErrorCodes();

describe('liveErrorMessage', () => {
  it('has a UI text for every error code of the spec', () => {
    for (const { code } of spec.filter((entry) => entry.code !== 'INTERNAL_ERROR')) {
      expect(liveErrorMessage(new ApiError(code)), code).not.toBe('Ошибка сервера');
    }
  });

  it('uses the text of the spec column for every error code', () => {
    for (const { code, uiText } of spec) {
      expect(liveErrorMessage(new ApiError(code)), code).toBe(uiText);
    }
  });

  it('keeps the texts of the old client', () => {
    for (const code of OLD_CODES) {
      expect(liveErrorMessage(new ApiError(code)), code).toBe(errorMessage(new ApiError(code)));
    }
  });

  it('reports a network failure as server unavailable', () => {
    expect(liveErrorMessage(new TypeError('Failed to fetch'))).toBe('Сервер недоступен');
  });

  it('falls back to a generic text for an unknown code', () => {
    expect(liveErrorMessage(new ApiError('SOMETHING_NEW'))).toBe('Ошибка сервера');
  });
});
