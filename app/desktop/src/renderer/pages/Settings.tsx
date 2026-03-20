import { useState } from 'react';

export function Settings() {
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  const handleBackfill = async () => {
    setIsBackfilling(true);
    setBackfillResult(null);
    try {
      const count = await window.chat.backfillSummaries();
      setBackfillResult(
        count > 0
          ? `Обновлено ${count} сессий`
          : 'Все сессии уже имеют summary',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setBackfillResult(`Ошибка: ${msg}`);
    } finally {
      setIsBackfilling(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <section className="max-w-lg">
        <h2 className="text-sm font-semibold text-neutral-300 mb-2">Кросс-контекст агентов</h2>
        <p className="text-xs text-neutral-500 mb-3">
          Генерирует summary для всех сессий, у которых его ещё нет.
          Это позволит агентам видеть контекст из других разделов.
        </p>
        <button
          onClick={handleBackfill}
          disabled={isBackfilling}
          className="px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {isBackfilling ? 'Обновляю...' : 'Обновить контекст'}
        </button>
        {backfillResult && (
          <p className={`mt-2 text-xs ${backfillResult.startsWith('Ошибка') ? 'text-red-400' : 'text-green-400'}`}>
            {backfillResult}
          </p>
        )}
      </section>
    </div>
  );
}
