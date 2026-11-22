// Ожидаемый отказ API: HTTP-статус и код для клиента
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(code);
  }
}
