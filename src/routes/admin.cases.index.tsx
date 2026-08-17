import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Eye, EyeOff, FolderOpen, Plus, Trash2 } from "lucide-react";

import {
  fetchAdminCases,
  publishCaseEntry,
  removeCaseEntry,
  reorderCaseEntries,
} from "../lib/admin.rpc";
import { GRADIENTS } from "../data/case-presets";
import { Pattern } from "../components/site/Portfolio";

export const Route = createFileRoute("/admin/cases/")({
  loader: () => fetchAdminCases(),
  head: () => ({
    meta: [{ title: "Кейсы — админка IT-Agent" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: CasesPage,
});

function CasesPage() {
  const cases = Route.useLoaderData();
  const router = useRouter();

  async function togglePublished(slug: string, published: boolean) {
    await publishCaseEntry({ data: { slug, published } });
    router.invalidate();
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= cases.length) return;
    const order = cases.map((item) => item.slug);
    [order[index], order[target]] = [order[target], order[index]];
    await reorderCaseEntries({ data: { slugs: order } });
    router.invalidate();
  }

  async function remove(slug: string, title: string) {
    if (
      !window.confirm(`Удалить кейс «${title}»? Страница пропадёт с сайта, вернуть будет нельзя.`)
    ) {
      return;
    }
    await removeCaseEntry({ data: { slug } });
    router.invalidate();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-xl tracking-tight">Кейсы</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {cases.length === 0
              ? "Пока ни одного"
              : `${cases.length} всего · ${cases.filter((c) => c.published).length} на сайте`}
          </p>
        </div>
        <Link
          to="/admin/cases/new"
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Новый кейс
        </Link>
      </div>

      {cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <FolderOpen className="mx-auto h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-muted-foreground">
            Кейсов нет. Пока их нет, раздел «Работы» на сайте не показывается.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {cases.map((item, index) => (
            <li
              key={item.slug}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
            >
              {/* Обложка — та же, что на сайте: так видно, что выбрал,
                  не открывая кейс. */}
              <div
                className={`relative hidden h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br sm:block ${GRADIENTS[item.gradient]}`}
              >
                <Pattern kind={item.pattern} />
              </div>

              <Link to="/admin/cases/$slug" params={{ slug: item.slug }} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  {!item.published && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      черновик
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  /works/{item.slug}
                  {item.result ? ` · ${item.result}` : ""}
                </div>
              </Link>

              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Выше"
                  className="grid h-9 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === cases.length - 1}
                  aria-label="Ниже"
                  className="grid h-9 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => togglePublished(item.slug, !item.published)}
                  aria-label={item.published ? "Снять с сайта" : "Опубликовать"}
                  title={item.published ? "Снять с сайта" : "Опубликовать"}
                  className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {item.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.slug, item.title)}
                  aria-label="Удалить"
                  className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
