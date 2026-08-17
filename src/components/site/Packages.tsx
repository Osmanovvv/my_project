import { Link } from "@tanstack/react-router";
import { useLoaderData } from "@tanstack/react-router";

export function Packages({ extended = false }: { extended?: boolean }) {
  /* Тарифы приходят из снимка контента: цены правятся из админки. */
  const { packages } = useLoaderData({ from: "__root__" });

  return (
    // Три колонки только с lg. На md (768) карточка получала ~160px под
    // содержимое, и цена `text-3xl` вида «от 180 000 ₽» не влезала — её
    // обрезало. `min-w-0` на карточке нужен отдельно: у грид-элементов
    // min-width по умолчанию `auto`, поэтому длинное слово внутри распирало
    // колонку и уводило страницу в горизонтальный скролл.
    <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
      {packages.map((p) => {
        const featured = p.featured;
        return (
          <div
            key={p.id}
            className={
              "relative flex min-w-0 flex-col rounded-3xl p-8 transition-all duration-300 " +
              (featured
                ? "bg-ink text-background shadow-2xl shadow-accent/20 lg:scale-[1.03]"
                : "border border-border bg-surface hover:border-accent/30 hover:card-lift")
            }
          >
            {featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent text-accent-foreground text-[10px] font-bold tracking-widest rounded-full uppercase">
                Рекомендуем
              </span>
            )}

            <div className={"text-sm " + (featured ? "text-white/60" : "text-muted-foreground")}>
              {p.who}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">{p.name}</div>
            <div
              className={
                "mt-4 font-display text-3xl font-semibold " + (featured ? "text-white" : "")
              }
            >
              {p.priceFrom}
            </div>

            <ul className="mt-7 space-y-3.5 flex-1">
              {p.points.map((pt) => (
                <li key={pt} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  <span className={featured ? "text-white/85" : "text-foreground/85"}>{pt}</span>
                </li>
              ))}
            </ul>

            {extended && (
              <dl
                className={
                  "mt-6 pt-6 border-t space-y-3 text-sm " +
                  (featured ? "border-white/10" : "border-border")
                }
              >
                <Row k="Срок" v={p.term} featured={featured} />
                <Row k="На выходе" v={p.result} featured={featured} />
                <Row k="Когда не нужен" v={p.notFor} featured={featured} />
              </dl>
            )}

            <Link
              to="/contacts"
              className={
                "mt-8 inline-flex h-12 items-center justify-center rounded-xl text-sm font-semibold transition-colors " +
                (featured
                  ? "bg-accent text-accent-foreground hover:brightness-110"
                  : "border border-border text-foreground hover:bg-surface")
              }
            >
              Обсудить пакет
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function Row({ k, v, featured }: { k: string; v: string; featured?: boolean }) {
  return (
    <div className="flex gap-3">
      {/* Было `text-white/40` — контраст 3.81 на тёмной карточке при норме
          4.5 для мелкого текста. Подписи «Срок», «Результат», «Не подойдёт»
          набраны прописными в 12 пикселей, то есть читаются тяжелее обычного,
          и выцветать им нельзя. */}
      <dt
        className={
          "w-28 shrink-0 text-xs uppercase tracking-wider " +
          (featured ? "text-white/65" : "text-muted-foreground")
        }
      >
        {k}
      </dt>
      {/* `min-w-0` + перенос по словам: без них длинное слово вроде
          «Автоматизированный» не даёт флекс-элементу сжаться и распирает
          карточку — на 768 страница уезжала вправо на 58px. */}
      <dd className={"min-w-0 break-words " + (featured ? "text-white/85" : "text-foreground/90")}>
        {v}
      </dd>
    </div>
  );
}
