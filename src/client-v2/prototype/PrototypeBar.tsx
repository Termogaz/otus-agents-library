import { cn } from '@/lib/utils';
import type { Scenario } from './scenarios';

type Props = {
  scenarios: readonly Scenario[];
  // Текущий сценарий: его ссылка помечается aria-current="page"
  current: Scenario;
};

// Панель над приложением: восемь состояний макета по хешу (D-10). Подсказка — обычный текст
// без живой роли: единственный alert страницы остаётся у приложения (D-12)
export function PrototypeBar({ scenarios, current }: Props) {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-2 px-4 pt-4 md:px-6 md:pt-6">
      <p className="text-sm font-semibold text-text">Прототип на демо-данных</p>
      <nav aria-label="Состояния прототипа" className="flex flex-wrap gap-4">
        {scenarios.map((scenario) => (
          <a
            key={scenario.name}
            href={`#${scenario.name}`}
            aria-current={scenario.name === current.name ? 'page' : undefined}
            className={cn(
              'py-2 underline underline-offset-4',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              scenario.name === current.name ? 'font-semibold text-text' : 'text-accent',
            )}
          >
            {scenario.label}
          </a>
        ))}
      </nav>
      <p className="text-sm text-text-muted">{current.hint}</p>
    </div>
  );
}
