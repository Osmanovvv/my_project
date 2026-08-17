import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, TriangleAlert } from "lucide-react";
import { readAttribution } from "../../lib/attribution";
import { SectionEyebrow } from "./SectionEyebrow";
import { CheckMark } from "./CheckMark";
import {
  LEAD_FIELD_ORDER,
  LEAD_LIMITS,
  normalizeLead,
  validateLead,
  type LeadErrors,
} from "../../lib/lead";

type Props = {
  compact?: boolean;
  id?: string;
};

type Status = "idle" | "sending" | "sent" | "error";

type LeadResponse = { ok?: boolean; error?: string; fields?: LeadErrors };

/**
 * Сообщения о сбое никуда не отправляют пользователя: публичных каналов
 * связи пока нет (см. `CONTACT_CHANNELS`). Раньше здесь стояло «напишите
 * в Telegram» со ссылкой на чужой аккаунт — то есть неудавшуюся заявку
 * сайт предлагал отнести постороннему человеку.
 */
const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: "Слишком много заявок подряд. Попробуйте ещё раз через минуту.",
  not_configured: "Приём заявок временно не настроен. Попробуйте позже.",
  delivery_failed: "Не получилось доставить заявку. Попробуйте ещё раз через минуту.",
};

const FALLBACK_MESSAGE = "Не получилось отправить. Попробуйте ещё раз через минуту.";

export function ContactSection({ compact = false, id }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<LeadErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const fieldPrefix = useId();

  const fieldId = (name: string) => `${fieldPrefix}-${name}`;

  function focusFirstError(found: LeadErrors) {
    const first = LEAD_FIELD_ORDER.find((field) => found[field]);
    if (!first) return;
    document.getElementById(fieldId(first))?.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    const form = event.currentTarget;
    const data = new FormData(form);

    const lead = normalizeLead({
      name: data.get("name"),
      contact: data.get("contact"),
      task: data.get("task"),
      page: window.location.pathname + window.location.search,
      source: readAttribution(),
    });

    const found = validateLead(lead);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setStatus("idle");
      setFailure(null);
      focusFirstError(found);
      return;
    }

    setErrors({});
    setFailure(null);
    setStatus("sending");

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...lead, company: String(data.get("company") ?? "") }),
      });

      const payload = (await response.json().catch(() => null)) as LeadResponse | null;

      if (response.status === 422 && payload?.fields) {
        setErrors(payload.fields);
        setStatus("idle");
        focusFirstError(payload.fields);
        return;
      }

      if (!response.ok || !payload?.ok) {
        const message = ERROR_MESSAGES[payload?.error ?? ""] ?? FALLBACK_MESSAGE;
        setStatus("error");
        setFailure(message);
        toast.error("Заявка не отправлена", { description: message });
        return;
      }

      form.reset();
      setStatus("sent");
      toast.success("Заявка отправлена", {
        description: "Свяжемся в течение рабочего дня в Telegram или по телефону.",
      });
    } catch (error) {
      console.error("[lead] отправка не удалась", error);
      setStatus("error");
      setFailure(FALLBACK_MESSAGE);
      toast.error("Заявка не отправлена", { description: FALLBACK_MESSAGE });
    }
  }

  /** Пользователь правит поле — снимаем ошибку и прошлый неудачный статус. */
  function clearError(field: keyof LeadErrors) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setStatus((prev) => (prev === "error" || prev === "sent" ? "idle" : prev));
    setFailure(null);
  }

  const sending = status === "sending";

  const afterPoints = [
    "Ответим в Telegram или по телефону",
    "Разберём задачу — без ТЗ и обязательств",
    "Предложим, с чего начать",
  ];

  return (
    <section
      id={id}
      className={compact ? "container-page py-16 sm:py-24" : "container-page py-24 sm:py-32"}
    >
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        <div>
          <SectionEyebrow>Первый шаг</SectionEyebrow>
          <h2 className="mt-3 text-3xl sm:text-4xl font-display">Получить разбор системы заявок</h2>
          <p className="mt-4 text-muted-foreground max-w-md">
            Оставьте контакт — вернёмся с коротким разбором вашей ситуации. Никакого длинного ТЗ на
            старте не нужно.
          </p>

          <ul className="mt-8 space-y-3">
            {afterPoints.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm">
                <CheckMark />
                <span className="text-foreground/90">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* method="post" обязателен. Форма отправляется через fetch, но если
            JavaScript не загрузился, браузер отправит её сам — а по умолчанию
            это GET, то есть имя, телефон и текст задачи уедут в строку адреса
            и осядут в истории браузера, логах сервера и заголовке Referer.
            Это контактные данные клиента, им там не место. */}
        <form
          method="post"
          onSubmit={onSubmit}
          noValidate
          className="relative rounded-2xl border border-border bg-surface p-6 sm:p-8 space-y-5"
        >
          {/* Honeypot: спрятан от людей, заполняют только боты. */}
          <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
            <label htmlFor={fieldId("company")}>Компания</label>
            <input
              id={fieldId("company")}
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <Field
            id={fieldId("name")}
            label="Имя"
            name="name"
            placeholder="Как к вам обращаться"
            autoComplete="name"
            maxLength={LEAD_LIMITS.name.max}
            error={errors.name}
            onInput={() => clearError("name")}
          />
          <Field
            id={fieldId("contact")}
            label="Telegram или телефон"
            name="contact"
            placeholder="@username или +7…"
            /* Поле принимает и телефон, и ник, поэтому `tel` — самая полезная
               подсказка: браузер предложит сохранённый номер. */
            autoComplete="tel"
            maxLength={LEAD_LIMITS.contact.max}
            error={errors.contact}
            onInput={() => clearError("contact")}
          />
          <div>
            <label className="text-xs text-muted-foreground" htmlFor={fieldId("task")}>
              {/* Без /60: пометка «необязательно» — часть подписи к полю,
                  а не декорация, и должна читаться так же, как сама подпись. */}
              Коротко о задаче <span className="text-muted-foreground">(необязательно)</span>
            </label>
            <textarea
              id={fieldId("task")}
              name="task"
              rows={3}
              maxLength={LEAD_LIMITS.task.max}
              onInput={() => clearError("task")}
              aria-invalid={errors.task ? true : undefined}
              aria-describedby={errors.task ? `${fieldId("task")}-error` : undefined}
              placeholder="Например: интернет-магазин, много заявок теряется"
              className={
                "mt-2 w-full rounded-lg bg-background border px-3.5 py-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring resize-none " +
                (errors.task ? "border-destructive" : "border-input")
              }
            />
            {errors.task && (
              <p id={`${fieldId("task")}-error`} className="mt-1.5 text-xs text-destructive">
                {errors.task}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium transition hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {sending ? "Отправляем…" : "Отправить заявку"}
            {!sending && <ArrowRight className="h-4 w-4" />}
          </button>

          <p aria-live="polite" className="sr-only">
            {sending ? "Отправляем заявку" : status === "sent" ? "Заявка отправлена" : ""}
          </p>

          {status === "sent" && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent-soft p-3.5 text-sm text-foreground"
            >
              <CheckMark />
              <span>Заявка отправлена — свяжемся в течение рабочего дня.</span>
            </div>
          )}

          {failure && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-3.5 text-sm"
            >
              <div className="flex items-start gap-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-foreground">{failure}</p>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Нажимая, вы соглашаетесь на обработку контактных данных.
          </p>
        </form>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  name,
  placeholder,
  autoComplete,
  maxLength,
  error,
  onInput,
}: {
  id: string;
  label: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  error?: string;
  onInput?: () => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onInput={onInput}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={
          "mt-2 w-full h-11 rounded-lg bg-background border px-3.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring " +
          (error ? "border-destructive" : "border-input")
        }
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
