"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PROVIDERS, DEFAULT_PROVIDER, TARGET_LENGTHS } from "@/lib/models";
import ClarifyModal from "@/components/ClarifyModal";
import type { ClarifyQuestion } from "@/lib/clarify";
import type { ClarifyAnswer } from "@/lib/prompts/blueprint";

const KEY_STORAGE = "ai-author:apiKey";

// Dev-only: when set, the server routes generation through the mock provider or
// the local `claude` CLI, so no API key is needed.
const DEV_BACKEND = process.env.NEXT_PUBLIC_LLM_BACKEND?.toLowerCase();
const USING_DEV_BACKEND = DEV_BACKEND === "mock" || DEV_BACKEND === "cli";

const field =
  "w-full rounded-lg border border-line bg-field p-2.5 text-sm text-ink outline-none transition focus:border-go";

export default function HomePage() {
  const router = useRouter();

  const [description, setDescription] = useState("");
  const [targetLength, setTargetLength] = useState<keyof typeof TARGET_LENGTHS>("NOVEL");
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [model, setModel] = useState(PROVIDERS[DEFAULT_PROVIDER].defaultModel);

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [clarifyFailed, setClarifyFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the saved key from the browser (never sent anywhere except per-request).
  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) setApiKey(saved);
  }, []);

  function onProviderChange(id: string) {
    setProvider(id);
    setModel(PROVIDERS[id].defaultModel);
  }

  function onApiKeyChange(value: string) {
    setApiKey(value);
    if (value) localStorage.setItem(KEY_STORAGE, value);
    else localStorage.removeItem(KEY_STORAGE);
  }

  function headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey.trim()) h["x-llm-key"] = apiKey.trim();
    return h;
  }

  function validate(): boolean {
    setError(null);
    if (!USING_DEV_BACKEND && !apiKey.trim()) {
      setError("Add your API key first.");
      return false;
    }
    if (description.trim().length < 10) {
      setError("Tell me a little more about your story.");
      return false;
    }
    return true;
  }

  // Step 1: find the biggest gaps in the idea and open the modal to resolve them.
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setClarifyFailed(false);
    setLoadingQuestions(true);
    try {
      const res = await fetch("/api/blueprint/clarify", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ description, targetLength, provider, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't generate questions.");
      const qs = (data.questions ?? []) as ClarifyQuestion[];
      if (qs.length === 0) {
        // Nothing ambiguous enough to ask about — go straight to the blueprint.
        await generate([]);
        return;
      }
      setQuestions(qs);
      setModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate questions.");
      setClarifyFailed(true);
    } finally {
      setLoadingQuestions(false);
    }
  }

  // Step 2: generate the blueprint, folding in whatever the writer answered.
  async function generate(answers: ClarifyAnswer[]) {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/blueprint", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ description, targetLength, provider, model, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate blueprint.");
      router.push(`/story/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setGenerating(false); // leave the modal open so they can retry
    }
  }

  const busy = loadingQuestions || generating;

  const providerConfig = PROVIDERS[provider];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Start a new story</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Describe your story. We&apos;ll plan it into a chapter-by-chapter blueprint you can refine.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <form onSubmit={onSubmit} className="space-y-6 lg:col-span-2">
        {/* Story description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-ink">
            Your story
          </label>
          <p className="mb-2 text-xs text-ink-soft">
            Be as vague or detailed as you like — the more you include (see the checklist), the closer the
            blueprint will match what you imagine.
          </p>
          <textarea
            id="description"
            data-tour="describe"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            placeholder="A washed-up detective in a flooded near-future city takes one last case…"
            className={field}
          />
        </div>

        {/* Length + model */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="length" className="block text-sm font-medium text-ink">
              Target length
            </label>
            <select
              id="length"
              value={targetLength}
              onChange={(e) => setTargetLength(e.target.value as keyof typeof TARGET_LENGTHS)}
              className={`mt-2 ${field}`}
            >
              {Object.values(TARGET_LENGTHS).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="model" className="flex items-center gap-1.5 text-sm font-medium text-ink">
              Model
              <span className="rounded bg-ai-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai-ink">
                AI
              </span>
            </label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={`mt-2 ${field}`}
            >
              {providerConfig.generationModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Provider (single option for now, but ready for more) */}
        {Object.keys(PROVIDERS).length > 1 && (
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-ink">
              Provider
            </label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => onProviderChange(e.target.value)}
              className={`mt-2 ${field}`}
            >
              {Object.values(PROVIDERS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* API key — hidden when a dev backend is active */}
        {USING_DEV_BACKEND ? (
          <p className="rounded-lg border border-ai/30 bg-ai-soft px-3 py-2 text-xs text-ai-ink">
            Dev backend active (<span className="font-semibold">{DEV_BACKEND}</span>):{" "}
            {DEV_BACKEND === "cli"
              ? "generation runs through your local Claude CLI / subscription. No API key needed."
              : "generation returns canned mock data instantly. No API key or model call."}
          </p>
        ) : (
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-ink">
              {providerConfig.label} API key
            </label>
            <p className="mb-2 text-xs text-ink-soft">
              Stored only in this browser and sent with each request. Never saved on our servers.
            </p>
            <div className="flex gap-2">
              <input
                id="apiKey"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="sk-ant-…"
                className={field}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="shrink-0 rounded-lg border border-line bg-control px-3 text-sm text-ink transition hover:bg-control-hover"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        )}

        {/* Hidden while the modal is up — it shows its own errors there. */}
        {error && !modalOpen && (
          <p className="rounded-lg border border-red-700/20 bg-red-700/10 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-go px-4 py-3 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover disabled:opacity-50"
          >
            {loadingQuestions
              ? "Reading your idea…"
              : generating
                ? "Planning your story… (this can take a minute or two)"
                : "Generate blueprint"}
          </button>

          {/* If the clarify step itself failed, let them generate without it. */}
          {clarifyFailed && !busy && (
            <button
              type="button"
              onClick={() => generate([])}
              className="w-full text-center text-sm font-medium text-ink-soft underline-offset-2 transition hover:text-ink hover:underline"
            >
              Skip questions and generate anyway
            </button>
          )}
        </div>
      </form>

        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-xl border border-line bg-surface p-5 shadow-card">
            <h2 className="text-sm font-semibold text-ink">What to include</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Anything you leave out, the AI invents. Touch on whatever you have an opinion about:
            </p>
            <ul className="mt-4 space-y-3 text-sm text-ink/90">
              {STORY_TIPS.map((tip) => (
                <li key={tip.label} className="flex gap-2.5">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ai" />
                  <span>
                    <span className="font-medium text-ink">{tip.label}</span>
                    <span className="text-ink-soft"> — {tip.hint}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-soft">
              How it&apos;s <em>written</em> — your prose voice and style — is set separately under{" "}
              <Link href="/voices" className="font-medium text-ai hover:underline">
                Voices
              </Link>
              , so you don&apos;t need to describe that here.
            </p>
          </div>
        </aside>
      </div>

      {modalOpen && (
        <ClarifyModal
          questions={questions}
          busy={generating}
          error={error}
          onGenerate={(answers) => generate(answers)}
          onSkip={() => generate([])}
          onClose={() => {
            setModalOpen(false);
            setError(null);
          }}
        />
      )}
    </main>
  );
}

// Prompts for the "What to include" sidebar on the story-creation form.
const STORY_TIPS: { label: string; hint: string }[] = [
  { label: "Premise / hook", hint: "the core idea or the “what if” that sparked it" },
  { label: "Main characters", hint: "names, roles, what they want, and their flaws" },
  { label: "Setting & time", hint: "where and when it takes place" },
  { label: "Genre & tone", hint: "e.g. cozy mystery, bleak sci-fi, hopeful, funny" },
  { label: "Point of view & tense", hint: "first or third person, past or present" },
  { label: "Key beats or ending", hint: "moments you definitely want, or how it ends" },
  { label: "Themes", hint: "ideas you want the story to explore" },
  { label: "Comparisons", hint: "“in the vein of ___” books, films, or authors" },
  { label: "Things to avoid", hint: "content, tropes, or clichés to steer clear of" },
];
