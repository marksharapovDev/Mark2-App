const TODAY = '2026-03-21';

interface TodayItem {
  time?: string;
  icon: string;
  text: string;
  sphere: string;
  sphereColor: string;
}

const TODAY_ITEMS: TodayItem[] = [
  {
    time: '15:00',
    icon: '\uD83C\uDFCB\uFE0F',
    text: 'Зал — Плечи + пресс (запланировано на 22 мар)',
    sphere: 'Health',
    sphereColor: 'text-orange-400',
  },
  {
    icon: '\uD83D\uDCCB',
    text: 'Сдать ДЗ «Производные» — дедлайн 25 мар',
    sphere: 'Study',
    sphereColor: 'text-purple-400',
  },
  {
    icon: '\uD83D\uDCDA',
    text: 'Подготовить материал по рекурсии для Миши (урок 25 мар)',
    sphere: 'Teaching',
    sphereColor: 'text-green-400',
  },
  {
    icon: '\uD83D\uDCBB',
    text: 'Claude Bridge: streaming — в работе',
    sphere: 'Dev',
    sphereColor: 'text-blue-400',
  },
  {
    icon: '\uD83D\uDCCA',
    text: 'Доклад по квантовой механике — дедлайн 3 апр',
    sphere: 'Study',
    sphereColor: 'text-purple-400',
  },
];

export function TodayWidget() {
  const date = new Date(TODAY);
  const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  const formatted = `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}, ${dayNames[date.getDay()]}`;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-bold text-neutral-200">Сегодня</h2>
        <span className="text-sm text-neutral-500">{formatted}</span>
      </div>

      <div className="space-y-1.5">
        {TODAY_ITEMS.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 py-1">
            {item.time ? (
              <span className="text-[11px] text-neutral-500 w-10 shrink-0 font-mono">{item.time}</span>
            ) : (
              <span className="w-10 shrink-0" />
            )}
            <span className="text-sm shrink-0">{item.icon}</span>
            <span className="text-xs text-neutral-300 flex-1 truncate">{item.text}</span>
            <span className={`text-[10px] shrink-0 ${item.sphereColor}`}>{item.sphere}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
