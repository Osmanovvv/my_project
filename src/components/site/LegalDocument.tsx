import { Link, useLoaderData } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { SITE_URL } from "../../lib/seo";
import {
  fillLegal,
  LEAD_RETENTION_YEARS,
  LEGAL_DOCS,
  LEGAL_VERSION,
  legalContactLabel,
  operatorLabel,
  type LegalDoc,
  type LegalVars,
} from "../../data/legal";
import { PageHero } from "./PageHero";

/**
 * Страница юридического документа: политика или согласие.
 *
 * Один компонент на оба документа — у них одинаковая структура (разделы
 * с абзацами и списками) и одинаковые подстановки. Текст берётся из кода,
 * реквизиты оператора и почта — из снимка контента, который уже загружен
 * в корне. Отдельного запроса на сервер странице не нужно.
 *
 * Разделы пронумерованы: на документ ссылаются по номерам разделов
 * («см. раздел 5»), и это не украшение.
 */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  const { texts, contacts } = useLoaderData({ from: "__root__" });

  const email = contacts.find((channel) => channel.id === "email")?.value;
  const vars: LegalVars = {
    operator: operatorLabel(texts),
    contact: legalContactLabel(email),
    /* Тот же адрес, что в canonical и карте сайта: соберут под другим
       доменом — документы не будут говорить про чужой. */
    site: siteHost(),
    version: formatVersion(LEGAL_VERSION),
    years: String(LEAD_RETENTION_YEARS),
  };

  const other = doc.path === "/privacy" ? LEGAL_DOCS["/consent"] : LEGAL_DOCS["/privacy"];

  return (
    <>
      <PageHero eyebrow="Документы" title={doc.title} description={doc.lead} mascotPose="peek">
        <p className="text-sm text-muted-foreground">Редакция от {vars.version}</p>
      </PageHero>

      <article className="container-page py-14 sm:py-20">
        <div className="max-w-3xl">
          {doc.sections.map((section, index) => (
            <section key={section.heading} className={index === 0 ? "" : "mt-10"}>
              <h2 className="font-display text-xl sm:text-2xl leading-snug">
                <span className="text-accent tabular-nums">{index + 1}.</span> {section.heading}
              </h2>
              <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-foreground/90">
                {section.body.map((paragraph, i) =>
                  typeof paragraph === "string" ? (
                    <p key={i}>{fillLegal(paragraph, vars)}</p>
                  ) : (
                    <ul key={i} className="list-disc space-y-1.5 pl-6 marker:text-accent">
                      {paragraph.items.map((item) => (
                        <li key={item}>{fillLegal(item, vars)}</li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}

          <div className="mt-14 rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Второй документ</p>
                <Link
                  to={other.path}
                  className="mt-0.5 inline-block font-display text-base text-foreground underline decoration-foreground/30 underline-offset-4 transition hover:text-accent hover:decoration-accent"
                >
                  {other.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{other.lead}</p>
              </div>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}

function siteHost(): string {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return SITE_URL;
  }
}

/**
 * «2026-09-16» → «16 сентября 2026» — в документе дата читается словами.
 * Без «г.»: в конце фразы стоит своя точка, и «г..» выглядело бы опечаткой.
 */
function formatVersion(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  const name = months[(month ?? 1) - 1];
  if (!year || !day || !name) return iso;
  return `${day} ${name} ${year}`;
}
