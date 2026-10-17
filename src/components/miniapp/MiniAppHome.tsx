import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleHelp,
  Globe,
  Layers3,
  LifeBuoy,
  LoaderCircle,
  MessageCircle,
  Send,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { CATALOG_ORDER, type Package, type Service } from "../../data/services";
import {
  LEAD_FIELD_ORDER,
  LEAD_LIMITS,
  normalizeLead,
  validateLead,
  type LeadErrors,
} from "../../lib/lead";
import type { CaseStudy, PublicContent } from "../../lib/content.rpc";
import { AccentText } from "../site/AccentText";

type MiniAppHomeProps = {
  content: Pick<PublicContent, "services" | "packages" | "faq" | "texts">;
  cases: CaseStudy[];
  firstName: string;
  username: string;
  isOnline: boolean;
  onOpenBot: () => void;
  onOpenConversation: (conversationId: number) => Promise<void>;
  entry: "catalog" | null;
};

type View =
  | { kind: "home" }
  | { kind: "services" }
  | { kind: "service"; service: Service }
  | { kind: "packages" }
  | { kind: "works" }
  | { kind: "faq" }
  | { kind: "request" }
  | { kind: "success"; leadId: number; conversationId: number }
  | { kind: "leads" };

type MiniAppLead = {
  id: number;
  name: string;
  contact: string;
  task: string;
  status: string;
  createdAt: number;
  conversationId: number;
  conversationStatus: string;
};

const ACTION_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--mini-button)] px-4 py-3 text-center text-sm font-semibold text-[var(--mini-button-text)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mini-button)] disabled:cursor-wait disabled:opacity-60";
const SECONDARY_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--mini-button)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--mini-button)] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mini-button)]";

const SHORTCUTS = [
  { kind: "services" as const, title: "Услуги", text: "Подобрать решение", icon: GridIcon },
  { kind: "packages" as const, title: "Пакеты", text: "Сайт, бот и админка", icon: Layers3 },
  { kind: "works" as const, title: "Работы", text: "Посмотреть проекты", icon: BriefcaseBusiness },
  { kind: "faq" as const, title: "Вопросы", text: "Перед началом", icon: CircleHelp },
];

function GridIcon({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      ▦
    </span>
  );
}

export function MiniAppHome({
  content,
  cases,
  firstName,
  username,
  isOnline,
  onOpenBot,
  onOpenConversation,
  entry,
}: MiniAppHomeProps) {
  const { services, packages, faq, texts } = content;
  const catalog = CATALOG_ORDER.flatMap((id) => services.filter((item) => item.id === id));
  const [view, setView] = useState<View>(() =>
    entry === "catalog" ? { kind: "services" } : { kind: "home" },
  );
  const [leads, setLeads] = useState<MiniAppLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [conversationError, setConversationError] = useState<string | null>(null);

  const openConversation = async (conversationId: number) => {
    setConversationError(null);
    try {
      await onOpenConversation(conversationId);
    } catch (error) {
      setConversationError(error instanceof Error ? error.message : "Не удалось открыть диалог.");
    }
  };

  const openLeads = () => {
    setView({ kind: "leads" });
    setLeadsLoading(true);
    setLeadsError(null);
    if (!isOnline) {
      setLeadsLoading(false);
      setLeadsError("Нет соединения с интернетом. Повторите после восстановления сети.");
      return;
    }
    fetchWithTimeout("/api/telegram/miniapp/leads", { credentials: "same-origin" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          ok?: boolean;
          leads?: MiniAppLead[];
        } | null;
        if (!response.ok || !body?.ok) throw new Error("Не удалось загрузить обращения.");
        setLeads(body.leads ?? []);
      })
      .catch((error: unknown) =>
        setLeadsError(
          error instanceof Error
            ? error.message
            : "Не получилось загрузить заявки. Повторите попытку.",
        ),
      )
      .finally(() => setLeadsLoading(false));
  };

  const goHome = () => setView({ kind: "home" });
  const openRequest = () => setView({ kind: "request" });

  if (view.kind === "service") {
    return (
      <Screen title={view.service.cardTitle} onBack={() => setView({ kind: "services" })}>
        <ServiceDetails service={view.service} onRequest={openRequest} />
      </Screen>
    );
  }
  if (view.kind === "services") {
    return (
      <Screen title="Каталог услуг" onBack={goHome}>
        <p className="text-sm leading-6 text-[var(--mini-hint)]">
          Выберите направление — в карточке есть описание, ориентир по стоимости и срокам.
        </p>
        <div className="mt-4 space-y-3">
          {catalog.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onClick={() => setView({ kind: "service", service })}
            />
          ))}
        </div>
        <button type="button" className={`${ACTION_CLASS} mt-5`} onClick={openRequest}>
          Оставить заявку <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </Screen>
    );
  }
  if (view.kind === "packages") {
    return (
      <Screen title="Пакеты" onBack={goHome}>
        <p className="text-sm leading-6 text-[var(--mini-hint)]">
          Сайт, бот и админка работают как одно целое.
        </p>
        <div className="mt-4 space-y-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
        <button type="button" className={`${ACTION_CLASS} mt-5`} onClick={openRequest}>
          Обсудить пакет <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </Screen>
    );
  }
  if (view.kind === "works") {
    return (
      <Screen title="Работы" onBack={goHome}>
        {cases.length === 0 ? (
          <EmptyState text="Портфолио скоро пополнится. Пока можно обсудить вашу задачу в боте." />
        ) : (
          <div className="space-y-3">
            {cases.map((item) => (
              <WorkCard key={item.slug} item={item} />
            ))}
          </div>
        )}
      </Screen>
    );
  }
  if (view.kind === "faq") {
    return (
      <Screen title="Вопросы" onBack={goHome}>
        <div className="space-y-3">
          {faq.map((item) => (
            <Question key={item.id ?? item.q} question={item.q} answer={item.a} />
          ))}
        </div>
        <button type="button" className={`${ACTION_CLASS} mt-5`} onClick={openRequest}>
          Задать свой вопрос <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </button>
      </Screen>
    );
  }
  if (view.kind === "request") {
    return (
      <Screen title="Новая заявка" onBack={goHome}>
        <LeadForm
          firstName={firstName}
          username={username}
          isOnline={isOnline}
          onSuccess={(leadId, conversationId) =>
            setView({ kind: "success", leadId, conversationId })
          }
        />
      </Screen>
    );
  }
  if (view.kind === "success") {
    return (
      <Screen title="Заявка принята" onBack={goHome}>
        <SuccessState
          leadId={view.leadId}
          onOpenConversation={() => openConversation(view.conversationId)}
          error={conversationError}
          onOpenLeads={openLeads}
          onHome={goHome}
        />
      </Screen>
    );
  }
  if (view.kind === "leads") {
    return (
      <Screen title="Мои заявки" onBack={goHome}>
        {leadsLoading ? (
          <LoadingInline />
        ) : leadsError ? (
          <ErrorState text={leadsError} onRetry={openLeads} />
        ) : leads.length === 0 ? (
          <EmptyState text="Здесь появятся заявки, которые вы отправите через Mini App." />
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onOpenConversation={openConversation} />
            ))}
          </div>
        )}
        {conversationError && (
          <p role="alert" className="mt-3 text-sm text-red-200">
            {conversationError}
          </p>
        )}
        <button type="button" className={`${ACTION_CLASS} mt-5`} onClick={openRequest}>
          Новая заявка <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </Screen>
    );
  }

  const previewFaq = faq.filter((item) => item.preview).slice(0, 3);
  const questions = previewFaq.length > 0 ? previewFaq : faq.slice(0, 3);

  return (
    <div className="[overflow-wrap:anywhere]">
      <section aria-labelledby="miniapp-home-title" className="pb-6 pt-7">
        <p className="text-sm text-[var(--mini-hint)]">
          Здравствуйте{firstName ? `, ${firstName}` : ""}!
        </p>
        <p className="mt-5 text-xs font-medium text-[var(--mini-button)]">
          {texts["home.hero.eyebrow"]}
        </p>
        <h1
          id="miniapp-home-title"
          className="mt-3 text-[2rem] font-semibold leading-[1.15] tracking-tight [&_.text-accent]:text-[var(--mini-button)]"
        >
          <AccentText text={texts["home.hero.title"]} />
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--mini-hint)]">
          {texts["home.hero.subtitle"]}
        </p>
        <button type="button" onClick={openRequest} className={`${ACTION_CLASS} mt-6`}>
          <Send className="h-4 w-4 shrink-0" aria-hidden="true" /> Оставить заявку
        </button>
        <button
          type="button"
          onClick={onOpenBot}
          className="mt-3 w-full text-center text-xs text-[var(--mini-button)] underline underline-offset-4"
        >
          Или обсудить проект в боте
        </button>
      </section>

      <nav aria-label="Разделы Mini App" className="grid grid-cols-2 gap-3">
        {SHORTCUTS.map(({ kind, title, text, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => setView({ kind })}
            className="min-w-0 rounded-2xl bg-[var(--mini-secondary)] p-4 text-left transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mini-button)]"
          >
            <Icon className="h-5 w-5 text-[var(--mini-button)]" />
            <span className="mt-3 block text-sm font-semibold">{title}</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--mini-hint)]">{text}</span>
          </button>
        ))}
      </nav>

      <section aria-labelledby="miniapp-services-title" className="mt-9">
        <SectionHeading
          id="miniapp-services-title"
          title="Услуги"
          text={texts["page.packages.singleLead"]}
        />
        <div className="mt-4 space-y-3">
          {catalog.slice(0, 3).map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onClick={() => setView({ kind: "service", service })}
            />
          ))}
        </div>
        {catalog.length > 3 && (
          <button
            type="button"
            className={`${SECONDARY_CLASS} mt-3 w-full`}
            onClick={() => setView({ kind: "services" })}
          >
            Все услуги <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </section>

      <section aria-labelledby="miniapp-packages-title" className="mt-9">
        <SectionHeading
          id="miniapp-packages-title"
          title={texts["home.packages.title"]}
          text={texts["home.packages.note"]}
        />
        <div className="mt-4 space-y-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
        <button
          type="button"
          className={`${SECONDARY_CLASS} mt-3 w-full`}
          onClick={() => setView({ kind: "packages" })}
        >
          Открыть пакеты <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>

      <section aria-labelledby="miniapp-works-title" className="mt-9">
        <SectionHeading
          id="miniapp-works-title"
          title="Работы"
          text={cases.length > 0 ? texts["home.works.note"] : undefined}
        />
        <div className="mt-4 space-y-3">
          {cases.length === 0 ? (
            <EmptyState text="Портфолио скоро пополнится. Пока можно обсудить вашу задачу в боте." />
          ) : (
            cases.slice(0, 2).map((item) => <WorkCard key={item.slug} item={item} />)
          )}
        </div>
        {cases.length > 2 && (
          <button
            type="button"
            className={`${SECONDARY_CLASS} mt-3 w-full`}
            onClick={() => setView({ kind: "works" })}
          >
            Все работы <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </section>

      <section aria-labelledby="miniapp-faq-title" className="mt-9">
        <SectionHeading
          id="miniapp-faq-title"
          title={texts["home.faq.title"]}
          text={texts["page.faq.lead"]}
        />
        <div className="mt-4 space-y-3">
          {questions.map((item) => (
            <Question key={item.id ?? item.q} question={item.q} answer={item.a} />
          ))}
        </div>
        {faq.length > questions.length && (
          <button
            type="button"
            className={`${SECONDARY_CLASS} mt-3 w-full`}
            onClick={() => setView({ kind: "faq" })}
          >
            Все вопросы <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </section>

      <section className="mt-9 rounded-3xl bg-[var(--mini-secondary)] p-5">
        <UserRound className="h-6 w-6 text-[var(--mini-button)]" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold">Ваши обращения</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--mini-hint)]">
          Здесь сохраняются заявки, отправленные из этого Telegram-аккаунта.
        </p>
        <button type="button" onClick={openLeads} className={`${SECONDARY_CLASS} mt-5 w-full`}>
          Мои заявки <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
      <section className="mt-4 rounded-3xl bg-[var(--mini-secondary)] p-5">
        <MessageCircle className="h-6 w-6 text-[var(--mini-button)]" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold">Есть идея или вопрос?</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--mini-hint)]">
          Оставьте заявку или продолжите общение в боте.
        </p>
        <button type="button" onClick={openRequest} className={`${ACTION_CLASS} mt-5`}>
          Новая заявка <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 pb-2 pt-7 text-xs text-[var(--mini-hint)]">
        <span>IT-Agent</span>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4"
        >
          Политика обработки данных <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </a>
      </footer>
    </div>
  );
}

function Screen({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="[overflow-wrap:anywhere] pb-4 pt-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-10 items-center gap-2 text-sm text-[var(--mini-button)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Назад
      </button>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function SectionHeading({ id, title, text }: { id: string; title: string; text?: string }) {
  return (
    <div className="px-1">
      <h2
        id={id}
        className="text-xl font-semibold tracking-tight [&_.text-accent]:text-[var(--mini-button)]"
      >
        <AccentText text={title} />
      </h2>
      {text && <p className="mt-2 text-sm leading-6 text-[var(--mini-hint)]">{text}</p>}
    </div>
  );
}

function ServiceCard({ service, onClick }: { service: Service; onClick: () => void }) {
  const Icon: LucideIcon =
    service.category === "websites" ? Globe : service.category === "bots" ? Bot : LifeBuoy;
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full min-w-0 rounded-2xl bg-[var(--mini-secondary)] p-5 text-left transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mini-button)]"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--mini-button)]" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{service.cardTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--mini-hint)]">{service.short}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs">
        <span className="text-sm font-semibold">{service.priceFrom}</span>
        <span className="text-[var(--mini-hint)]">{service.timeline}</span>
      </div>
      <span className="mt-3 inline-flex min-h-6 items-center gap-1 text-xs text-[var(--mini-button)]">
        Подробнее <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </span>
    </button>
  );
}

function ServiceDetails({ service, onRequest }: { service: Service; onRequest: () => void }) {
  return (
    <>
      <div className="rounded-3xl bg-[var(--mini-secondary)] p-5">
        <p className="text-sm leading-6 text-[var(--mini-hint)]">{service.description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-[var(--mini-hint)]">Стоимость</p>
            <p className="mt-1 font-semibold">{service.priceFrom}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--mini-hint)]">Срок</p>
            <p className="mt-1 font-semibold">{service.timeline}</p>
          </div>
        </div>
      </div>
      <a
        href={service.path}
        target="_blank"
        rel="noopener noreferrer"
        className={`${SECONDARY_CLASS} mt-4 w-full`}
      >
        Полная страница на сайте <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </a>
      <button type="button" className={`${ACTION_CLASS} mt-3`} onClick={onRequest}>
        Обсудить эту услугу <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </>
  );
}

function PackageCard({ pkg }: { pkg: Package }) {
  return (
    <article className="min-w-0 rounded-2xl bg-[var(--mini-secondary)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{pkg.name}</h3>
        {pkg.featured && (
          <span className="rounded-full bg-[var(--mini-bg)] px-2.5 py-1 text-xs text-[var(--mini-button)]">
            Рекомендуем
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-5 text-[var(--mini-hint)]">{pkg.who}</p>
      <p className="mt-4 text-xl font-semibold">{pkg.priceFrom}</p>
      <p className="mt-1 text-xs text-[var(--mini-hint)]">{pkg.term}</p>
      <p className="mt-4 text-sm leading-6">{pkg.result}</p>
      <details className="group mt-4 border-t border-[var(--mini-bg)] pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          Что входит{" "}
          <ChevronDown
            className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <ul className="mt-2 space-y-2 pb-1 text-sm leading-5 text-[var(--mini-hint)]">
          {pkg.points.map((point) => (
            <li key={point} className="flex gap-2">
              <span className="text-[var(--mini-button)]" aria-hidden="true">
                •
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function WorkCard({ item }: { item: CaseStudy }) {
  return (
    <a
      href={`/works/${item.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-2xl bg-[var(--mini-secondary)] transition-opacity hover:opacity-90"
    >
      {item.cover && (
        <img
          src={item.cover.url}
          width={item.cover.width}
          height={item.cover.height}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className="aspect-[16/9] w-full object-cover"
        />
      )}
      <div className="p-5">
        <p className="text-xs text-[var(--mini-hint)]">
          {item.client} · {item.industry}
        </p>
        <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--mini-hint)]">{item.result}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--mini-button)]">
          Посмотреть на сайте <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}

function Question({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-2xl bg-[var(--mini-secondary)] px-5">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <p className="pb-5 text-sm leading-6 text-[var(--mini-hint)]">{answer}</p>
    </details>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl bg-[var(--mini-secondary)] p-5 text-sm leading-6 text-[var(--mini-hint)]">
      {text}
    </p>
  );
}

function LoadingInline() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--mini-secondary)] p-6 text-sm text-[var(--mini-hint)]">
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> Загружаем заявки…
    </div>
  );
}

function LeadCard({
  lead,
  onOpenConversation,
}: {
  lead: MiniAppLead;
  onOpenConversation: (conversationId: number) => void;
}) {
  const status: Record<string, string> = {
    new: "Новая",
    in_progress: "В работе",
    won: "Завершена",
    lost: "Закрыта",
    spam: "Закрыта",
    open: "Открыта",
    waiting_operator: "Ждём ответа",
    waiting_client: "Ждём вас",
    closed: "Закрыта",
  };
  return (
    <article className="rounded-2xl bg-[var(--mini-secondary)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--mini-hint)]">Заявка №{lead.id}</p>
          <h2 className="mt-1 text-base font-semibold">{lead.task || "Новая задача"}</h2>
        </div>
        <span className="rounded-full bg-[var(--mini-bg)] px-2.5 py-1 text-xs text-[var(--mini-button)]">
          {status[lead.status] ?? status[lead.conversationStatus] ?? "В работе"}
        </span>
      </div>
      <p className="mt-3 text-xs text-[var(--mini-hint)]">{formatDate(lead.createdAt)}</p>
      {lead.contact && <p className="mt-2 text-sm">Контакт: {lead.contact}</p>}
      <button
        type="button"
        className={`${SECONDARY_CLASS} mt-4 w-full`}
        onClick={() => onOpenConversation(lead.conversationId)}
      >
        Продолжить в боте <MessageCircle className="h-4 w-4" aria-hidden="true" />
      </button>
    </article>
  );
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

function LeadForm({
  firstName,
  username,
  isOnline,
  onSuccess,
}: {
  firstName: string;
  username: string;
  isOnline: boolean;
  onSuccess: (leadId: number, conversationId: number) => void;
}) {
  const [name, setName] = useState(firstName);
  const [contact, setContact] = useState(username ? `@${username.replace(/^@/, "")}` : "");
  const [task, setTask] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    if (!isOnline) {
      setFailure("Нет соединения с интернетом. Повторите после восстановления сети.");
      return;
    }
    const lead = normalizeLead({
      name,
      contact,
      task,
      page: "/miniapp",
      source: "telegram_miniapp",
      consent,
    });
    const found = validateLead(lead);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const first = LEAD_FIELD_ORDER.find((field) => found[field]);
      if (first) document.getElementById(`miniapp-${first}`)?.focus();
      return;
    }
    setErrors({});
    setFailure(null);
    setStatus("sending");
    const requestKey = submissionKey ?? crypto.randomUUID();
    if (!submissionKey) setSubmissionKey(requestKey);
    try {
      const response = await fetchWithTimeout("/api/telegram/miniapp/leads", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "Idempotency-Key": requestKey },
        body: JSON.stringify({
          name: lead.name,
          contact: lead.contact,
          task: lead.task,
          consent: true,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        lead_id?: number;
        conversation_id?: number;
        fields?: LeadErrors;
        error?: string;
      } | null;
      if (response.status === 422 && body?.fields) {
        setErrors(body.fields);
        setStatus("idle");
        return;
      }
      if (!response.ok || !body?.ok || !body.lead_id || !body.conversation_id)
        throw new Error(body?.error || "Не получилось отправить заявку.");
      setStatus("idle");
      setSubmissionKey(null);
      onSuccess(body.lead_id, body.conversation_id);
    } catch (error) {
      setStatus("idle");
      setFailure(error instanceof Error ? error.message : "Не получилось отправить заявку.");
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field
        id="miniapp-name"
        label="Имя"
        value={name}
        onChange={setName}
        placeholder="Как к вам обращаться"
        error={errors.name}
      />
      <Field
        id="miniapp-contact"
        label="Telegram или телефон"
        value={contact}
        onChange={setContact}
        placeholder="@username или +7…"
        error={errors.contact}
      />
      <div>
        <label htmlFor="miniapp-task" className="text-xs text-[var(--mini-hint)]">
          Коротко о задаче <span>(необязательно)</span>
        </label>
        <textarea
          id="miniapp-task"
          value={task}
          onChange={(event) => setTask(event.target.value)}
          maxLength={LEAD_LIMITS.task.max}
          rows={4}
          placeholder="Что нужно сделать?"
          className="mt-2 w-full resize-none rounded-2xl bg-[var(--mini-secondary)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--mini-button)]"
        />
        {errors.task && <p className="mt-1 text-xs text-red-300">{errors.task}</p>}
      </div>
      <label htmlFor="miniapp-consent" className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          id="miniapp-consent"
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--mini-button)]"
        />
        <span>
          Даю{" "}
          <a
            href="/consent"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            согласие на обработку данных
          </a>
          <span className="text-[var(--mini-hint)]"> · </span>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            политика обработки данных
          </a>
        </span>
      </label>
      {errors.consent && <p className="text-xs text-red-300">{errors.consent}</p>}
      {failure && (
        <p role="alert" className="rounded-2xl bg-red-950/40 p-3 text-sm text-red-200">
          {failure}
        </p>
      )}
      <button type="submit" disabled={status === "sending" || !isOnline} className={ACTION_CLASS}>
        {status === "sending"
          ? "Отправляем…"
          : !isOnline
            ? "Нет соединения"
            : failure && submissionKey
              ? "Повторить отправку"
              : "Отправить заявку"}
        <Send className="h-4 w-4" aria-hidden="true" />
      </button>
      <p className="text-center text-xs leading-5 text-[var(--mini-hint)]">
        Без калькулятора: обсудим задачу и точную стоимость в диалоге.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-[var(--mini-hint)]">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={id.endsWith("name") ? LEAD_LIMITS.name.max : LEAD_LIMITS.contact.max}
        className="mt-2 w-full rounded-2xl bg-[var(--mini-secondary)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--mini-button)]"
      />
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}

function SuccessState({
  leadId,
  onOpenConversation,
  error,
  onOpenLeads,
  onHome,
}: {
  leadId: number;
  onOpenConversation: () => void;
  error: string | null;
  onOpenLeads: () => void;
  onHome: () => void;
}) {
  return (
    <div className="rounded-3xl bg-[var(--mini-secondary)] p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--mini-button)] text-[var(--mini-button-text)]">
        <Check className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold">Заявка №{leadId} принята</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--mini-hint)]">
        Мы сохранили обращение. Можно посмотреть его в разделе «Мои заявки» или продолжить общение в
        боте.
      </p>
      <button type="button" className={`${ACTION_CLASS} mt-5`} onClick={onOpenConversation}>
        Продолжить в боте <MessageCircle className="h-4 w-4" aria-hidden="true" />
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-200">
          {error}
        </p>
      )}
      <button type="button" className={`${SECONDARY_CLASS} mt-3 w-full`} onClick={onOpenLeads}>
        Мои заявки
      </button>
      <button
        type="button"
        className="mt-4 w-full text-center text-xs text-[var(--mini-button)] underline underline-offset-4"
        onClick={onHome}
      >
        Вернуться на главную
      </button>
    </div>
  );
}

function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl bg-red-950/30 p-5 text-sm leading-6 text-red-100">
      <p role="alert">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-2xl border border-red-200/40 px-4 py-2 text-sm font-semibold text-red-100"
      >
        Повторить загрузку
      </button>
    </div>
  );
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Сервер не ответил вовремя. Проверьте соединение и повторите.");
    }
    if (!navigator.onLine) throw new Error("Нет соединения с интернетом.");
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
