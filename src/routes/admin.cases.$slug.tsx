import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { CaseForm, type CaseFormValues } from "../components/admin/CaseForm";
import { fetchAdminCase, updateCaseEntry } from "../lib/admin.rpc";

export const Route = createFileRoute("/admin/cases/$slug")({
  loader: async ({ params }) => {
    const study = await fetchAdminCase({ data: { slug: params.slug } });
    if (!study) throw notFound();
    return study;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Кейс"} — админка IT-Agent` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EditCasePage,
});

function EditCasePage() {
  const study = Route.useLoaderData();
  const router = useRouter();

  async function save(values: CaseFormValues) {
    await updateCaseEntry({ data: { slug: study.slug, input: values } });
    await router.invalidate();
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

      <div>
        <h1 className="font-display text-xl tracking-tight">{study.title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">/works/{study.slug}</p>
      </div>

      <CaseForm
        initial={study}
        submitLabel="Сохранить"
        onSubmit={save}
        publicHref={`/works/${study.slug}`}
      />
    </div>
  );
}
