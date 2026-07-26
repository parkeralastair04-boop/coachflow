"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { footballEmptyPreset } from "@/lib/football-identity";
import { FeaturePageHeader } from "@/components/feature-page-header";
import { FormErrorAlert } from "@/components/form-error-alert";
import { SetupRequiredPanel } from "@/components/setup-required-panel";
import {
  formatNewsPublishedDate,
  slugifyNewsTitle,
  type AcademyNewsRow,
} from "@/lib/academy-news";
import { createClient } from "@/lib/supabase";
import {
  getSetupRequiredMessage,
  isMissingTableError,
} from "@/lib/supabase-errors";
import { sanitizeDashboardSaveError } from "@/lib/user-facing-errors";

type NewsFormState = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImageUrl: string;
};

const emptyForm: NewsFormState = {
  title: "",
  slug: "",
  summary: "",
  content: "",
  coverImageUrl: "",
};

const NEWS_SELECT =
  "id, academy_id, coach_id, title, slug, summary, content, cover_image_url, published, published_at, created_at, updated_at";

export function NewsManager() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [articles, setArticles] = useState<AcademyNewsRow[]>([]);
  const [form, setForm] = useState<NewsFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [setupTables, setSetupTables] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
    setSlugTouched(false);
    setSubmitError(null);
  }, []);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupTables([]);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You need to be signed in to manage news.");
        setArticles([]);
        return;
      }

      setCoachId(user.id);

      const [{ data: profile, error: profileError }, { data, error: newsError }] =
        await Promise.all([
          supabase.from("profiles").select("academy_id").eq("id", user.id).maybeSingle(),
          supabase
            .from("academy_news")
            .select(NEWS_SELECT)
            .eq("coach_id", user.id)
            .order("updated_at", { ascending: false }),
        ]);

      if (profileError) throw profileError;
      if (newsError) {
        if (isMissingTableError(newsError)) {
          setSetupTables(["academy_news"]);
          setArticles([]);
          return;
        }
        throw newsError;
      }

      setAcademyId((profile?.academy_id as string | null) ?? null);
      setArticles((data ?? []) as AcademyNewsRow[]);
    } catch (caughtError: unknown) {
      const maybeError =
        typeof caughtError === "object" && caughtError !== null
          ? (caughtError as { code?: string; message?: string })
          : null;
      if (isMissingTableError(maybeError)) {
        setSetupTables(["academy_news"]);
        setArticles([]);
      } else {
        setError(sanitizeDashboardSaveError(caughtError, { logLabel: "news-load" }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadArticles();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadArticles]);

  function startEdit(article: AcademyNewsRow) {
    setEditingId(article.id);
    setSlugTouched(true);
    setForm({
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      content: article.content,
      coverImageUrl: article.cover_image_url ?? "",
    });
    setSubmitError(null);
    setStatusMessage(null);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setStatusMessage(null);

    const title = form.title.trim();
    const slug = (form.slug.trim() || slugifyNewsTitle(title)).trim();
    const summary = form.summary.trim();
    const content = form.content.trim();
    const coverImageUrl = form.coverImageUrl.trim() || null;

    if (!title) {
      setSubmitError("Title is required.");
      return;
    }
    if (!slug) {
      setSubmitError("Slug is required.");
      return;
    }
    if (!summary) {
      setSubmitError("Summary is required.");
      return;
    }
    if (!content) {
      setSubmitError("Content is required.");
      return;
    }
    if (!coachId) {
      setSubmitError("You need to be signed in to save articles.");
      return;
    }
    if (!academyId) {
      setSubmitError("Link an academy in Academy Settings before publishing news.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        academy_id: academyId,
        coach_id: coachId,
        title,
        slug,
        summary,
        content,
        cover_image_url: coverImageUrl,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from("academy_news")
          .update(payload)
          .eq("id", editingId)
          .eq("coach_id", coachId);
        if (updateError) throw updateError;
        setStatusMessage("Article updated.");
      } else {
        const { error: insertError } = await supabase.from("academy_news").insert({
          ...payload,
          published: false,
          published_at: null,
        });
        if (insertError) throw insertError;
        setStatusMessage("Article created as a draft.");
      }

      resetForm();
      await loadArticles();
    } catch (caughtError: unknown) {
      setSubmitError(sanitizeDashboardSaveError(caughtError, { logLabel: "news-save" }));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(article: AcademyNewsRow) {
    if (!coachId) return;
    setTogglingId(article.id);
    setError(null);
    setStatusMessage(null);
    try {
      const supabase = createClient();
      const nextPublished = !article.published;
      const { error: updateError } = await supabase
        .from("academy_news")
        .update({
          published: nextPublished,
          published_at: nextPublished ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id)
        .eq("coach_id", coachId);
      if (updateError) throw updateError;
      setStatusMessage(nextPublished ? "Article published." : "Article unpublished.");
      await loadArticles();
    } catch (caughtError: unknown) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "news-publish" }));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(article: AcademyNewsRow) {
    if (!coachId) return;
    if (!window.confirm(`Delete “${article.title}”? This cannot be undone.`)) return;
    setDeletingId(article.id);
    setError(null);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("academy_news")
        .delete()
        .eq("id", article.id)
        .eq("coach_id", coachId);
      if (deleteError) throw deleteError;
      if (editingId === article.id) resetForm();
      setStatusMessage("Article deleted.");
      await loadArticles();
    } catch (caughtError: unknown) {
      setError(sanitizeDashboardSaveError(caughtError, { logLabel: "news-delete" }));
    } finally {
      setDeletingId(null);
    }
  }

  if (setupTables.length > 0) {
    return (
      <div className="space-y-6">
        <FeaturePageHeader
          featureKey="news"
          title="Academy News"
          subtitle="Publish club news for parents on your academy website."
        />
        <SetupRequiredPanel
          tables={setupTables}
          {...getSetupRequiredMessage(setupTables)}
          onRetry={() => void loadArticles()}
        />
      </div>
    );
  }

  return (
    <div className="page-content-enter space-y-8">
      <FeaturePageHeader
        featureKey="news"
        title="Academy News"
        subtitle="Draft and publish club updates for your academy website."
      />

      {error ? <FormErrorAlert message={error} /> : null}
      {statusMessage ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
          {statusMessage}
        </p>
      ) : null}

      {!academyId && !loading ? (
        <p className="text-muted rounded-2xl bg-black/[0.03] px-4 py-3 text-sm dark:bg-white/[0.04]">
          Link an academy in Academy Settings so published articles appear on your public website.
        </p>
      ) : null}

      <form onSubmit={handleSave} className="football-panel space-y-4 rounded-2xl p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">
          {editingId ? "Edit article" : "New article"}
        </h2>
        {submitError ? <FormErrorAlert message={submitError} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Title</span>
            <input
              value={form.title}
              onChange={(event) => {
                const title = event.target.value;
                setForm((current) => ({
                  ...current,
                  title,
                  slug: slugTouched ? current.slug : slugifyNewsTitle(title),
                }));
              }}
              className="border-border bg-background focus-visible:ring-accent/40 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus-visible:ring-2"
              required
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Slug</span>
            <input
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                setForm((current) => ({ ...current, slug: event.target.value }));
              }}
              className="border-border bg-background focus-visible:ring-accent/40 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus-visible:ring-2"
              required
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Summary</span>
            <textarea
              value={form.summary}
              onChange={(event) =>
                setForm((current) => ({ ...current, summary: event.target.value }))
              }
              rows={3}
              className="border-border bg-background focus-visible:ring-accent/40 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus-visible:ring-2"
              required
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Content</span>
            <textarea
              value={form.content}
              onChange={(event) =>
                setForm((current) => ({ ...current, content: event.target.value }))
              }
              rows={10}
              className="border-border bg-background focus-visible:ring-accent/40 w-full rounded-xl border px-3 py-2.5 text-sm leading-relaxed outline-none focus-visible:ring-2"
              required
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Cover image URL (optional)</span>
            <input
              type="url"
              value={form.coverImageUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, coverImageUrl: event.target.value }))
              }
              placeholder="https://"
              className="border-border bg-background focus-visible:ring-accent/40 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus-visible:ring-2"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent/40 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {editingId ? "Save changes" : "Create draft"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="news-list-heading" className="space-y-4">
        <h2 id="news-list-heading" className="text-lg font-semibold tracking-tight">
          Your articles
        </h2>
        {loading ? (
          <p className="text-muted text-sm">Loading articles…</p>
        ) : articles.length === 0 ? (
          <EmptyState {...footballEmptyPreset("news")} />
        ) : (
          <ul className="space-y-3" role="list">
            {articles.map((article) => {
              const publishedLabel = formatNewsPublishedDate(article.published_at);
              return (
                <li
                  key={article.id}
                  className="football-panel flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold tracking-tight">{article.title}</p>
                    <p className="text-muted mt-1 text-sm">
                      {article.published ? "Published" : "Draft"}
                      {publishedLabel ? ` · ${publishedLabel}` : ""}
                      {" · "}/{article.slug}
                    </p>
                    {article.summary ? (
                      <p className="text-muted mt-2 line-clamp-2 text-sm">{article.summary}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(article)}
                      className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-white/[0.06]"
                    >
                      <Pencil className="size-4" aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void togglePublish(article)}
                      disabled={togglingId === article.id}
                      className="border-border hover:bg-surface-hover focus-visible:ring-accent/40 inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 dark:hover:bg-white/[0.06]"
                    >
                      {togglingId === article.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : article.published ? (
                        "Unpublish"
                      ) : (
                        "Publish"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(article)}
                      disabled={deletingId === article.id}
                      className="border-border text-rose-700 hover:bg-rose-500/10 focus-visible:ring-accent/40 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 dark:text-rose-300"
                    >
                      {deletingId === article.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-4" aria-hidden />
                      )}
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
