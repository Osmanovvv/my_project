import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import { Check, Inbox, Phone, Send, TriangleAlert, Trash2, X } from "lucide-react";

import {
  fetchLeads,
  changeLeadStatus,
  saveLeadNote,
  readLead,
  removeLead,
  type LeadRecord,
  type LeadStatus,
} from "../lib/admin.rpc";

/**
 * Экран заявок — то, ради чего админка вообще затевалась.
 *
 * Данные грузит `loader` на сервере: список приходит уже в HTML, без
 * промежуточного состояния «загружаем». Обновления идут через серверные
 * функции и `router.invalidate()` — отдельного состояния списка на клиенте
 * нет, поэтому оно не может разъехаться с базой.
 */

const STATUS_TABS: Array<{ id: LeadStatus | "all"; label: string }> = [
  { id: "all", label: "Все" },
  { id: "new", label: "Новые" },
  { id: "in_progress", label: "В работе" },
  { id: "won", label: "Клиенты" },
  { id: "lost", label: "Отказы" },
  { id: "spam", label: "Спам" },
];

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  won: "Клиент",
  lost: "Отказ",
  spam: "Спам",
};

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: "bg-accent-soft text-accent",
  in_progress: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  won: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  lost: "bg-muted text-muted-foreground",
  spam: "bg-muted text-muted-foreground",
};

export const Route = createFileRoute("/admin/")({
  /**
   * `status` необязателен намеренно. Если сделать его обязательным, роутер
   * начнёт требовать `search` у КАЖДОЙ ссылки на админку — включая логотип
   * в шапке и переход после входа, — а адрес по умолчанию превратится
   * в `/admin?status=all`. Отсутствие параметра и означает «все».
   */
  validateSearch: (search: Record<string, unknown>): { status?: string } => ({
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  loaderDeps: ({ search }) => ({ status: search.status ?? "all" }),
  loader: ({ deps }) => fetchLeads({ data: { status: deps.status } }),
  head: () => ({
    meta: [
      { title: "Заявки — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const data = Route.useLoaderData();
  const status = Route.useSearch().status ?? "all";
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);

  const selected = data.leads.find((lead) => lead.id === openId) ?? null;

  async function open(lead: LeadRecord) {
    setOpenId(lead.id);
    if (lead.read_at === null) {
      await readLead({ data: { id: lead.id } });
      router.invalidate();
    }
  }

  return (
    <div className="space-y-5">
      <Summary leads={data.leads} unread={data.unread} />

      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.id;
          const count = data.counts[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                router.navigate({
                  to: "/admin",
                  /* «Все» — состояние по умолчанию, в адресе его не пишем. */
                  search: tab.id === "all" ? {} : { status: tab.id },
                })
              }
              className={
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition " +
                (active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              {tab.label}
              <span className={active ? "text-background/60" : "text-muted-foreground/70"}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {data.leads.length === 0 ? (
        <Empty status={status} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
          <ul className="space-y-2">
            {data.leads.map((lead) => (
              <li key={lead.id}>
                <LeadRow lead={lead} active={lead.id === openId} onOpen={() => open(lead)} />
              </li>
            ))}
          </ul>

          <div className="lg:sticky lg:top-20">
            {selected ? (
              <LeadDetail key={selected.id} lead={selected} onClose={() => setOpenId(null)} />
            ) : (
              <div className="hidden rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:block">
                Выберите заявку слева
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Строка «сегодня столько-то новых» вместо дашборда с нулями. */
function Summary({ leads, unread }: { leads: LeadRecord[]; unread: number }) {
  const today = format(new Date(), "d MMMM", { locale: ru });
  const last = leads[0];

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      <span className="font-medium">Сегодня {today}</span>
      <span className="text-muted-foreground">·</span>
      <span className={unread > 0 ? "font-medium text-accent" : "text-muted-foreground"}>
        {unread > 0 ? `${unread} ${plural(unread, "новая", "новые", "новых")}` : "новых нет"}
      </span>
      {last && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            последняя {formatDistanceToNow(last.created_at, { locale: ru, addSuffix: true })}
          </span>
        </>
      )}
    </div>
  );
}

function LeadRow({
  lead,
  active,
  onOpen,
}: {
  lead: LeadRecord;
  active: boolean;
  onOpen: () => void;
}) {
  const unread = lead.read_at === null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={
        "w-full rounded-xl border p-3.5 text-left transition " +
        (active
          ? "border-accent/50 bg-background shadow-sm"
          : "border-border bg-background/60 hover:border-accent/30 hover:bg-background")
      }
    >
      <div className="flex items-start gap-3">
        {/* Точка непрочитанного: место под неё занято всегда, иначе строки
            прыгают по горизонтали, когда заявку открыли. */}
        <span
          aria-hidden="true"
          className={
            "mt-1.5 h-2 w-2 shrink-0 rounded-full " + (unread ? "bg-accent" : "bg-transparent")
          }
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={"truncate text-sm " + (unread ? "font-semibold" : "font-medium")}>
              {lead.name}
            </span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {shortTime(lead.created_at)}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{lead.contact}</div>
          {lead.task && (
            <div className="mt-1.5 line-clamp-2 text-xs text-muted-foreground/90">{lead.task}</div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={
                "rounded-md px-1.5 py-0.5 text-[11px] font-medium " + STATUS_STYLE[lead.status]
              }
            >
              {STATUS_LABEL[lead.status]}
            </span>
            {lead.delivered === 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                <TriangleAlert className="h-3 w-3" />
                не дошла в Telegram
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function LeadDetail({ lead, onClose }: { lead: LeadRecord; onClose: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState(lead.note);
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);

  /* Заметка сохраняется сама через полсекунды после последнего нажатия:
     кнопка «Сохранить» на однострочном поле — лишний повод её забыть. */
  useEffect(() => {
    if (note === lead.note) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await saveLeadNote({ data: { id: lead.id, note } });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      router.invalidate();
    }, 500);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [note, lead.id, lead.note, router]);

  async function setStatus(status: LeadStatus) {
    await changeLeadStatus({ data: { id: lead.id, status } });
    router.invalidate();
  }

  async function onDelete() {
    if (!window.confirm(`Удалить заявку от «${lead.name}»? Отменить будет нельзя.`)) return;
    await removeLead({ data: { id: lead.id } });
    onClose();
    router.invalidate();
  }

  const telegram = toTelegramLink(lead.contact);
  const phone = toPhoneLink(lead.contact);

  return (
    <article className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg leading-tight">{lead.name}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {format(lead.created_at, "d MMMM yyyy, HH:mm", { locale: ru })}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть заявку"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {telegram && (
          <a
            href={telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition hover:brightness-110"
          >
            <Send className="h-4 w-4" />
            Написать
          </a>
        )}
        {phone && (
          <a
            href={phone}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
          >
            <Phone className="h-4 w-4" />
            Позвонить
          </a>
        )}
        <span className="inline-flex items-center rounded-lg bg-muted px-3 py-2 font-mono text-sm">
          {lead.contact}
        </span>
      </div>

      {lead.task && (
        <div className="mt-4">
          <div className="text-xs text-muted-foreground">Задача</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{lead.task}</p>
        </div>
      )}

      <dl className="mt-4 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
        <Meta label="Страница" value={lead.page || "—"} />
        <Meta label="Источник" value={formatSource(lead.source)} />
      </dl>

      {lead.delivered === 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-foreground">Заявка не дошла в Telegram, но сохранена здесь.</p>
            {lead.delivery_error && (
              <p className="mt-1 text-xs text-muted-foreground">{lead.delivery_error}</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="text-xs text-muted-foreground">Статус</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatus(id)}
              aria-pressed={lead.status === id}
              className={
                "rounded-lg px-2.5 py-1.5 text-sm transition " +
                (lead.status === id
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              {STATUS_LABEL[id]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline gap-2">
          <label htmlFor={`note-${lead.id}`} className="text-xs text-muted-foreground">
            Заметка
          </label>
          <span
            className={
              "ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition " +
              (saved ? "opacity-100" : "opacity-0")
            }
          >
            <Check className="h-3 w-3" />
            сохранено
          </span>
        </div>
        <textarea
          id={`note-${lead.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="О чём договорились, что обещали, когда перезвонить"
          className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
        />
      </div>

      <button
        type="button"
        onClick={onDelete}
        className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Удалить заявку
      </button>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function Empty({ status }: { status: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <Inbox className="mx-auto h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
      <p className="mt-3 text-sm text-muted-foreground">
        {status === "all"
          ? "Заявок пока нет. Они появятся здесь, как только кто-то отправит форму."
          : "В этом разделе пусто."}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────── мелочи ──────

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function shortTime(ts: number): string {
  if (isToday(ts)) return format(ts, "HH:mm");
  if (isYesterday(ts)) return "вчера";
  return format(ts, "d MMM", { locale: ru });
}

/** Из контакта вида `@name` или `name` делает ссылку на чат. */
function toTelegramLink(contact: string): string | null {
  const match = contact.trim().match(/^@?([a-zA-Z0-9_]{4,32})$/);
  return match ? `https://t.me/${match[1]}` : null;
}

function toPhoneLink(contact: string): string | null {
  const digits = contact.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return `tel:+${digits}`;
}

/** UTM приходят строкой JSON — показываем по-человечески. */
function formatSource(raw: string): string {
  if (!raw) return "прямой заход";
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const parts = Object.entries(parsed)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key.replace(/^utm_/, "")}: ${value}`);
    return parts.length ? parts.join(", ") : "прямой заход";
  } catch {
    return raw;
  }
}
