import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { CaseForm, type CaseFormValues } from "../components/admin/CaseForm";
import { createCaseEntry } from "../lib/admin.rpc";

/** Пустой кейс. Живёт здесь, а не в файле формы: там рядом с компонентом
    экспорт константы ломает горячую перезагрузку при разработке. */
const EMPTY_CASE: CaseFormValues = {
  slug: "",
  title: "",
  client: "",
  industry: "",
  result: "",
  summary: "",
  timeline: "",
  cover: null,
  gradient: "indigo",
  pattern: "grid",
  tags: [],
  challenge: [],
  solution: [],
  delivered: [],
  stack: [],
  services: [],
  published: false,
};

export const Route = createFileRoute("/admin/cases/new")({
  head: () => ({
    meta: [
      { title: "Новый кейс — админка IT-Agent" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NewCasePage,
});

function NewCasePage() {
  const router = useRouter();

  async function save(values: CaseFormValues) {
    const result = await createCaseEntry({ data: values });
    await router.invalidate();
    /* Уходим на страницу правки: адрес присвоен сервером, и дальше работать
       надо уже с ним, иначе повторное сохранение создало бы второй кейс. */
    router.navigate({ to: "/admin/cases/$slug", params: { slug: result.slug } });
  }

  return (
    <div className="space-y-4">
      <Link
        to="/admin/cases"
        className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Кейсы
      </Link>

      <h1 className="font-display text-xl tracking-tight">Новый кейс</h1>

      <CaseForm initial={EMPTY_CASE} submitLabel="Создать" onSubmit={save} />
    </div>
  );
}
