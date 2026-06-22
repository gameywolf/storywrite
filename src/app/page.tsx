"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PROVIDERS, DEFAULT_PROVIDER, TARGET_LENGTHS } from "@/lib/models";

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

  const [loading, setLoading] = useState(false);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!USING_DEV_BACKEND && !apiKey.trim()) {
      setError("Add your API key first.");
      return;
    }
    if (description.trim().length < 10) {
      setError("Tell me a little more about your story.");
      return;
    }

    setLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey.trim()) headers["x-llm-key"] = apiKey.trim();
      const res = await fetch("/api/blueprint", {
        method: "POST",
        headers,
        body: JSON.stringify({ description, targetLength, provider, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate blueprint.");
      router.push(`/story/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  const providerConfig = PROVIDERS[provider];

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="text-ai">AI</span> Author
          </h1>
          <Link href="/stories" className="text-sm font-medium text-ink-soft hover:text-ink hover:underline">
            Your stories →
          </Link>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          Describe your story. We&apos;ll plan it into a chapter-by-chapter blueprint you can refine.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Story description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-ink">
            Your story
          </label>
          <p className="mb-2 text-xs text-ink-soft">
            Be as vague or detailed as you like. Mention anything you care about — premise, characters, point of
            view, an ending you want, comparisons, things to avoid.
          </p>
          <textarea
            id="description"
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

        {error && (
          <p className="rounded-lg border border-red-700/20 bg-red-700/10 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-go px-4 py-3 text-sm font-semibold text-go-ink shadow-sm transition hover:bg-go-hover disabled:opacity-50"
        >
          {loading ? "Planning your story… (this can take a minute or two)" : "Generate blueprint"}
        </button>
      </form>
    </main>
  );
}
