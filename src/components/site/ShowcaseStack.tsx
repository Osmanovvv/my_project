import type { ReactNode } from "react";
import { CheckCheck, EllipsisVertical, Inbox, Menu, Paperclip, Send } from "lucide-react";

import { Mascot } from "./Mascot";

/**
 * Макеты продукта в герое: окно сайта, чат бота и MiniApp.
 *
 * Две вещи, ради которых блок переделан:
 *
 * 1. Сцена. Раньше это была статичная картинка — три карточки лежали
 *    рядом и ничего не рассказывали. Теперь за 8 секунд они проигрывают
 *    ровно то, что обещает заголовок: сигнал уходит с сайта вниз →
 *    к боту прилетает «Новая заявка». Заголовок говорит «не теряет
 *    заявки», и рядом видно, как заявка не теряется. Вся анимация
 *    на CSS, без состояния в React.
 *
 * 2. Реальная работа внутри рамок вместо абстрактных градиентов:
 *    скриншоты клиентского сайта в десктопе и на телефоне.
 *
 * Ключевые кадры сцены живут в `styles.css` рядом с описанием таймлайна.
 */

/** Общий цикл сцены: все элементы крутят его синхронно. */
const SCENE = "8s linear infinite both";

/* ──────────────────────────  окно сайта  ────────────────────────── */

/**
 * `captionAlign` переносит подпись к правому краю. Нужен там, где на низ
 * окна слева заходит соседняя карточка: подпись прижата к низу, и любой
 * заход накрывает её первой.
 */
export function BrowserCard({ captionAlign = "left" }: { captionAlign?: "left" | "right" }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-frame-edge bg-frame shadow-2xl shadow-black/25">
      {/* Волосяная линия под шапкой обязательна: без неё тёмный корпус
          сливается с тёмным скриншотом в одно пятно. */}
      <div className="flex items-center gap-2 border-b border-frame-edge px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/28" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/18" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
        <span className="ml-3 truncate font-mono text-[11px] text-frame-muted">
          stroitelstvo-domov2.netlify.app
        </span>
      </div>
      {/* 16/10 — родная пропорция снимка, кадр показан целиком. Была 4/3
          «как в эталоне», но там в этом месте рекламный ролик, которому и
          положено доминировать. У нас тут главный продукт — сайт, и резать
          его ради чужой пропорции неправильно. */}
      <div className="relative aspect-[16/10] bg-frame">
        <img
          src="/works/bricks-desktop.webp"
          width={880}
          height={550}
          alt="Сайт «Кирпичные дома», Краснодар — работа IT-Agent"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Затемнение под подпись: низ снимка тёмный не везде,
            без подложки текст местами терялся бы. */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        <div
          className={`absolute bottom-4 ${
            captionAlign === "right" ? "right-5 text-right" : "left-5"
          }`}
        >
          <div className="font-display text-lg text-white sm:text-xl">Кирпичные дома</div>
          <div className="text-xs text-white/70">Краснодар · сайт опубликован</div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────  MiniApp  ─────────────────────────── */

/**
 * Вертикальная карточка со снимком мобильной версии.
 *
 * Безрамочная, как в эталоне: корпуса телефона нет, снимок лежит от края
 * до края скруглённого прямоугольника. Поэтому ушли и подложка `p-1.5`,
 * и внутреннее кольцо — они разделяли корпус и экран, а разделять больше
 * нечего. Край держит контраст со светлой страницей, а не обводка.
 *
 * 9/16 — родная пропорция снимка (420×747), кадр без обрезки. Была 9/14
 * ради совпадения с эталоном, но там вертикальная карточка — видео, а у
 * нас экран телефона, и растягивать его в чужую пропорцию незачем.
 *
 * `caption` выключают там, где на низ карточки наезжает соседняя:
 * подпись попадает ровно в зону перекрытия и обрезается на полуслове.
 */
export function MiniAppCard({ caption = true }: { caption?: boolean }) {
  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-frame-edge bg-frame shadow-2xl shadow-black/25">
      <img
        src="/works/bricks-mobile.webp"
        width={420}
        height={747}
        alt="Мобильная версия сайта «Кирпичные дома»"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Подпись только с xl. Уже — карточка ужимается до ~130–150px, текст
          ломается на четыре строки и вылезает из-под затемнения на светлое
          небо снимка. Окно браузера подписано всегда, смысл не теряется. */}
      {caption && (
        <>
          <div className="absolute inset-x-0 bottom-0 hidden h-2/5 bg-gradient-to-t from-black/85 via-black/45 to-transparent xl:block" />
          <div className="absolute bottom-3 left-3 right-3 hidden xl:block">
            <div className="font-display text-sm leading-tight text-white">Кирпичные дома</div>
            <div className="text-[11px] text-white/70">адаптив под телефон</div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────  чат  ────────────────────────────── */

/**
 * Пузырь сообщения. Время стоит в одной строке с текстом и прижато к его
 * низу — так в Telegram, и так пузырь не разъезжается на два этажа.
 * `read` рисует двойную галочку «прочитано» на исходящем.
 */
function Bubble({
  children,
  time,
  out = false,
  read = false,
  className = "",
}: {
  children: ReactNode;
  time: string;
  out?: boolean;
  read?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-end gap-2 rounded-2xl px-3 py-1.5 ${
        out ? "rounded-br-md bg-accent" : "rounded-bl-md bg-tg-bubble"
      } ${className}`}
    >
      <p className={`text-xs leading-snug ${out ? "text-accent-foreground" : "text-white"}`}>
        {children}
      </p>
      {/* Прозрачность подобрана по контрасту, а не на глаз: на /45 и /70
          Lighthouse валил проверку читаемости мелкого текста. В Telegram
          метки времени тоже бледные, но 9px требуют не меньше 4.5:1. */}
      <span
        className={`mb-px flex shrink-0 items-center gap-0.5 text-[9px] ${
          out ? "text-accent-foreground/90" : "text-white/65"
        }`}
      >
        {time}
        {read && <CheckCheck className="h-3 w-3" />}
      </span>
    </div>
  );
}

export function ChatCard() {
  return (
    // Внешний слой без `overflow-hidden`: бейдж заявки торчит за край окна.
    <div className="relative">
      {/* Прилетает, когда сигнал с сайта дошёл до бота. */}
      <span
        className="absolute -top-2.5 right-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-medium text-accent-foreground shadow-lg shadow-accent/40"
        style={{ animation: `lead-badge ${SCENE}` }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent-foreground" />
        Новая заявка
      </span>

      <div className="overflow-hidden rounded-2xl border border-frame-edge bg-frame shadow-2xl shadow-black/25">
        {/* Шапка чата: корпус окна той же тональности, что у браузера и
            телефона, — три макета читаются как одна серия устройств. */}
        <div className="flex items-center gap-2.5 border-b border-frame-edge px-3 py-2">
          {/* Аватар бота — сам маскот: в мокапе показано ровно то, что продаём.
              Картинка крупнее круга и прижата к низу — в кадр попадают голова
              и корпус, ноги обрезаются, как на нормальной аватарке. */}
          <span className="grid h-8 w-8 shrink-0 place-items-end justify-center overflow-hidden rounded-full bg-accent/25">
            <Mascot size="sm" decorative glow={false} className="h-[41px] w-auto object-contain" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-white">IT-Agent</div>
            {/* Обе строки статуса в одной ячейке грида — см. `lead-status`. */}
            <div className="grid text-[11px] leading-tight">
              <span
                className="col-start-1 row-start-1 text-frame-muted"
                style={{ animation: `lead-status ${SCENE}` }}
              >
                бот
              </span>
              <span
                className="col-start-1 row-start-1 text-tg-accent"
                style={{ animation: `lead-typing ${SCENE}` }}
              >
                печатает…
              </span>
            </div>
          </div>
          <EllipsisVertical className="ml-auto h-4 w-4 shrink-0 text-frame-muted" />
        </div>

        <div className="space-y-1.5 bg-tg-screen px-2.5 py-2.5">
          <div className="flex justify-center pb-0.5">
            <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/65">
              Сегодня
            </span>
          </div>

          {/* Диалог намеренно про того же клиента, чей сайт лежит в соседних
              рамках: бот квалифицирует заявку на дом и забирает канал связи.
              Прежний текст был про адрес в Москве — он не бился ни с
              краснодарским застройщиком на скриншотах, ни с тем, что мы
              продаём (бот, который доводит заявку, а не записывает адрес). */}
          <Bubble time="12:04" className="w-fit max-w-[88%]">
            Здравствуйте! Какой метраж рассматриваете?
          </Bubble>

          <Bubble time="12:04" out read className="ml-auto w-fit max-w-[88%]">
            120 м², одноэтажный
          </Bubble>

          <div className="max-w-[92%]">
            <Bubble time="12:05">Подобрал 4 проекта. Куда отправить смету?</Bubble>
            {/* Инлайн-клавиатура — то, по чему бот в Telegram узнаётся мгновенно.
                Кнопки декоративные, поэтому не `button`: фокусировать нечего. */}
            <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
              <span className="rounded-lg bg-white/10 px-2 py-1 text-center text-[10px] text-tg-accent">
                В Telegram
              </span>
              <span className="rounded-lg bg-white/10 px-2 py-1 text-center text-[10px] text-tg-accent">
                На почту
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-frame-edge px-2.5 py-2">
          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] text-frame-muted sm:flex">
            <Menu className="h-3 w-3" />
            Меню
          </span>
          <span className="truncate text-[11px] text-frame-muted">Сообщение</span>
          <Paperclip className="ml-auto hidden h-3.5 w-3.5 shrink-0 text-frame-muted sm:block" />
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground max-sm:ml-auto">
            <Send className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────  админка  ────────────────────────── */

/**
 * Счётчик заявок — всё, что осталось от админки в композиции.
 *
 * Полноценная панель тут уже стояла и была снята: на 240px её таблица
 * превращалась в серое пятно, а четыре карточки одного веса лишали
 * композицию ритма. Плашка закрывает то же самое обещание из бейджа
 * («сайт · Telegram-бот · админка») одним крупным числом, которое
 * читается с одного взгляда, и не спорит с соседями за внимание.
 *
 * Число перещёлкивается ровно тогда, когда заявка доезжает по сцене.
 */
export function AdminBadge() {
  return (
    <div className="rounded-2xl border border-frame-edge bg-frame p-3 shadow-2xl shadow-black/25">
      <div className="flex items-center gap-1.5">
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-accent text-accent-foreground">
          <Inbox className="h-2.5 w-2.5" />
        </span>
        <span className="truncate text-[10px] text-frame-muted">Админка</span>
      </div>

      {/* Обе цифры в одной ячейке грида — плашка не прыгает по ширине. */}
      <div className="mt-2 grid font-display text-3xl leading-none text-white">
        <span
          className="col-start-1 row-start-1"
          style={{ animation: `lead-count-before ${SCENE}` }}
        >
          2
        </span>
        <span
          className="col-start-1 row-start-1"
          style={{ animation: `lead-count-after ${SCENE}` }}
        >
          3
        </span>
      </div>
      <div className="mt-1 text-[10px] leading-tight text-white/65">новые заявки</div>
    </div>
  );
}

/**
 * Плашка в правом нижнем углу композиции. Вынесена отдельно, потому что
 * это спорный элемент: закрывает пустой угол, но добавляет четвёртый
 * объект. Флаг здесь, чтобы включать/выключать одним значением.
 *
 * Ширина на пару процентов меньше свободной полосы — иначе плашка
 * встаёт вплотную к чату и читается как приклеенная.
 */
const SHOW_ADMIN_BADGE = false;

function AdminBadgeSlot() {
  if (!SHOW_ADMIN_BADGE) return null;
  return (
    <div className="absolute right-0 bottom-0 z-10 w-[26%]">
      <AdminBadge />
    </div>
  );
}

/* ──────────────────────────  композиция  ────────────────────────── */

/**
 * Точка-сигнал: заявка уходит с сайта к боту. Горизонталь задаётся снаружи —
 * она должна попадать и в окно, и в чат, а их колонки зависят от раскладки.
 */
function Signal({ x = "left-[26%]" }: { x?: string }) {
  return (
    <div className={`pointer-events-none absolute ${x} top-[42%] hidden h-[36%] w-px sm:block`}>
      <span
        className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-accent"
        style={{ boxShadow: "0 0 14px var(--accent)", animation: `lead-signal ${SCENE}` }}
      />
    </div>
  );
}

export function ShowcaseStack() {
  return (
    <div className="relative w-full">
      {/* ambient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/4 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-64 w-64 translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Mobile: stacked flow. Наложений нет — на такой ширине они съедают
          содержимое, а не добавляют глубину. */}
      <div className="relative space-y-4 sm:hidden">
        <BrowserCard />
        <div className="grid grid-cols-[38%_1fr] items-start gap-3">
          <MiniAppCard />
          <ChatCard />
        </div>
      </div>

      {/*
        Desktop: слоистая композиция. Пропорции сняты с эталона —
        окно 62% слева со сдвигом на 6% вниз, вертикальная карточка 42%
        справа от самого верха, чат 64% со сдвигом на 8% вправо. Поворотов
        нет: в эталоне карточки стоят ровно, наклон ломает сетку.

        Отличие от эталона одно, вынужденное: контейнер не квадрат с
        `bottom-0` у чата, а поток. У нас чат выше (шапка, дата, инлайн-
        клавиатура), и в фиксированном квадрате он на узких колонках
        наезжал бы снизу на подпись окна. В потоке высота считается по
        содержимому, и зазор держится на любой ширине.

        Порядок слоёв: чат (z-30) → телефон (z-20) → окно.
      */}
      {/* Ограничение 560px нужно только в диапазоне sm…lg, где герой стоит
          одной колонкой и композиция иначе растянулась бы на всю страницу.
          С lg у неё своя колонка шириной 586 — там кэп только не давал
          блоку дотянуться до правого края страницы, где заканчивается
          кнопка в шапке. */}
      <div className="relative mx-auto hidden w-full max-w-[560px] sm:block lg:max-w-none">
        {/* Отступ сверху — то поле, в которое выходит телефон. */}
        <div className="w-[72%] pt-[6%]">
          <BrowserCard />
        </div>
        <div className="relative z-30 mt-[2%] ml-[8%] w-[74%]">
          <ChatCard />
        </div>
        <div className="absolute top-0 right-0 z-20 w-[34%]">
          <MiniAppCard caption={false} />
        </div>
        <AdminBadgeSlot />
        <Signal />
      </div>
    </div>
  );
}
