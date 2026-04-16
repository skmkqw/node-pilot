"use client";

import { useEffect, useState } from "react";
import { getSystemStatus } from "@/lib/api/status";
import { SystemStatusDto } from "@/types/system-status";
import { StatusGrid } from "./status-grid";

export function StatusPage() {
    const [status, setStatus] = useState<SystemStatusDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let controller: AbortController | null = null;

        const load = async () => {
            controller?.abort();
            controller = new AbortController();

            try {
                const data = await getSystemStatus(controller.signal);
                if (!isActive) return;

                setStatus(data);
                setError(null);
            } catch (err) {
                if (!isActive) return;

                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }

                const message =
                    err instanceof Error ? err.message : "Unknown error occurred";
                setError(message);
            } finally {
                if (isActive) {
                    setIsLoading(false);
                    timeoutId = setTimeout(() => {
                        void load();
                    }, 5000);
                }
            }
        };

        void load();

        return () => {
            isActive = false;
            controller?.abort();
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);

    if (isLoading) {
        return (
            <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.28)] backdrop-blur xl:p-6">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                        <div className="h-3 w-32 animate-pulse rounded-full bg-white/10" />
                        <div className="mt-4 h-10 w-3/4 animate-pulse rounded-2xl bg-white/10" />
                        <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-white/8" />
                        <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-white/8" />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={index}
                                className="rounded-3xl border border-white/10 bg-white/5 p-5"
                            >
                                <div className="h-3 w-20 animate-pulse rounded-full bg-white/10" />
                                <div className="mt-6 h-8 w-24 animate-pulse rounded-2xl bg-white/10" />
                                <div className="mt-6 h-2 w-full animate-pulse rounded-full bg-white/8" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (error && !status) {
        return (
            <section className="rounded-[1.75rem] border border-rose-400/25 bg-rose-950/40 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.28)] backdrop-blur">
                <div className="inline-flex rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">
                    Connection issue
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-rose-50">
                    Backend unavailable
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-100/80">
                    Could not load server status. Check backend availability, API URL, and
                    CORS configuration.
                </p>
                <p className="mt-4 rounded-2xl border border-rose-300/14 bg-black/20 px-4 py-3 font-mono text-xs text-rose-100/75">
                    {error}
                </p>
            </section>
        );
    }

    return (
        <section className="space-y-4">
            {error ? (
                <div className="rounded-[1.35rem] border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100 shadow-[0_12px_30px_rgba(120,53,15,0.15)]">
                    Showing the last known status. The most recent refresh attempt failed.
                </div>
            ) : null}

            {status ? <StatusGrid status={status} /> : null}
        </section>
    );
}
