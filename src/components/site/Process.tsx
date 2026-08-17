import { Search, Layers, Rocket, TrendingUp } from "lucide-react";
import { Mascot } from "./Mascot";

const steps = [
  {
    n: "01",
    icon: Search,
    title: "Разбор",
    text: "Созваниваемся, разбираем текущий поток заявок и что теряется.",
  },
  {
    n: "02",
    icon: Layers,
    title: "Прототип",
    text: "Показываем структуру сайта и как всё будет выглядеть в админке.",
  },
  {
    n: "03",
    icon: Rocket,
    title: "Запуск",
    text: "Собираем сайт, бота и админку. Подключаем уведомления менеджеру.",
  },
  {
    n: "04",
    icon: TrendingUp,
    title: "Развитие",
    text: "После запуска добавляем правила, интеграции, аналитику.",
  },
];

export function Process() {
  return (
    // `overflow-hidden` обязателен: маскот-вотермарк ниже висит на `-right-6`
    // и с md вылезал за правый край страницы, добавляя горизонтальный скролл
    // в 2–3px на 768 и 1024. На 1440 поля контейнера его прятали, поэтому
    // на глаз баг не ловился.
    <div className="relative overflow-hidden">
      {/* subtle mascot watermark */}
      <Mascot
        decorative
        glow={false}
        className="pointer-events-none absolute -top-16 -right-6 h-40 w-auto opacity-[0.08] hidden md:block"
        style={{ animation: "mascot-float 7s ease-in-out infinite" }}
      />

      {/* horizontal progress rail */}
      <div className="hidden md:block absolute top-8 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div
        className="hidden md:block absolute top-[30px] left-[12%] h-1 w-[76%] rounded-full opacity-40"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--accent) 20%, var(--accent) 80%, transparent)",
        }}
      />

      <div className="relative grid md:grid-cols-4 gap-6 md:gap-5">
        {steps.map(({ n, icon: Icon, title, text }, i) => (
          <div
            key={n}
            className="group relative flex flex-col items-start rounded-2xl border border-border bg-background/80 p-6 hover:border-accent/40 hover:card-lift transition-all"
          >
            <div className="relative">
              <div className="absolute inset-0 -m-2 rounded-full bg-accent/20 blur-2xl opacity-0 group-hover:opacity-100 transition" />
              <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-background border border-border text-accent shadow-sm group-hover:border-accent/50 transition-all">
                <Icon className="h-5 w-5" />
                <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 px-1 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground shadow">
                  {n}
                </span>
              </div>
            </div>
            <div className="mt-5 font-display text-lg font-semibold">{title}</div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
            {/* Без /70: приглушённый цвет и без того светлый, а на 11px
                с разрядкой подпись переставала читаться. */}
            <span className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Шаг {i + 1} из {steps.length}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
