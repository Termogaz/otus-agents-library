// Вспомогательное для e2e: управляемая задержка ответа сервера без пауз по времени.

// Ворота: запрос ждёт `opened`, пока тест не вызовет `open()`
export function createGate(): { opened: Promise<void>; open: () => void } {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}
