/**
 * T-004. Ошибки слоя данных.
 */

/** Базовая ошибка адаптера (в т.ч. симулируемые сбои mock-адаптера). */
export class AdapterError extends Error {
  readonly method: string | null;

  constructor(message: string, options: { method?: string; cause?: unknown } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AdapterError";
    this.method = options.method ?? null;
  }
}

/** Ошибка api-адаптера: в P0 API не подключён (DATA_ADAPTER=api). */
export class ApiAdapterNotConnectedError extends AdapterError {
  constructor(method: string) {
    super(
      `API-адаптер не подключён в P0: метод ${method} недоступен. ` +
        "Установите DATA_ADAPTER=mock (текущий режим: api).",
      { method },
    );
    this.name = "ApiAdapterNotConnectedError";
  }
}
