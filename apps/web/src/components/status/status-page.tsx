"use client";

import { useEffect, useState } from "react";
import { getHistoricalSystemMetrics, getSystemStatus } from "@/lib/api/client";
import { SystemMetricDto } from "@/types/system-metric";
import { StatusDashboard } from "./status-dashboard";

const STATUS_REFRESH_MS = 5000;
const HISTORY_INTERVAL_SECONDS = 60;
const HISTORY_REFRESH_MS = HISTORY_INTERVAL_SECONDS * 1000;
const HISTORY_WINDOW_MS = 60 * 60 * 1000;

export function StatusPage() {
    const [status, setStatus] = useState<SystemMetricDto | null>(null);
    const [history, setHistory] = useState<SystemMetricDto[]>([]);
    const [historyWindow, setHistoryWindow] = useState(() => getHistoryWindow());
    const [isLoading, setIsLoading] = useState(true);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;
        let statusTimer: ReturnType<typeof setTimeout> | null = null;
        let historyTimer: ReturnType<typeof setTimeout> | null = null;
        let statusController: AbortController | null = null;
        let historyController: AbortController | null = null;

        const loadStatus = async () => {
            statusController?.abort();
            statusController = new AbortController();

            try {
                const data = await getSystemStatus(statusController.signal);
                if (!isActive) return;

                setStatus(data);
                setStatusError(null);
            } catch (err) {
                if (!isActive) return;

                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }

                setStatusError(
                    err instanceof Error ? err.message : "Unknown error occurred"
                );
            } finally {
                if (isActive) {
                    setIsLoading(false);
                    statusTimer = setTimeout(() => {
                        void loadStatus();
                    }, STATUS_REFRESH_MS);
                }
            }
        };

        const loadHistory = async () => {
            historyController?.abort();
            historyController = new AbortController();

            const nextWindow = getHistoryWindow();

            try {
                const data = await getHistoricalSystemMetrics(
                    {
                        start: nextWindow.startUtc,
                        end: nextWindow.endUtc,
                        minIntervalSeconds: HISTORY_INTERVAL_SECONDS,
                    },
                    historyController.signal
                );
                if (!isActive) return;

                setHistory(data);
                setHistoryWindow(nextWindow);
                setHistoryError(null);
            } catch (err) {
                if (!isActive) return;

                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }

                setHistoryError(
                    err instanceof Error ? err.message : "Unknown error occurred"
                );
            } finally {
                if (isActive) {
                    historyTimer = setTimeout(() => {
                        void loadHistory();
                    }, HISTORY_REFRESH_MS);
                }
            }
        };

        void Promise.all([loadStatus(), loadHistory()]);

        return () => {
            isActive = false;
            statusController?.abort();
            historyController?.abort();

            if (statusTimer) {
                clearTimeout(statusTimer);
            }

            if (historyTimer) {
                clearTimeout(historyTimer);
            }
        };
    }, []);

    if (isLoading) {
        return (
            <section className="rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.28)] backdrop-blur xl:p-6">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.48fr)]">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={index}
                                className="rounded-3xl border border-white/10 bg-white/5 p-5"
                            >
                                <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
                                <div className="mt-5 h-10 w-3/4 animate-pulse rounded-2xl bg-white/10" />
                                <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-white/8" />
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4">
                        {Array.from({ length: 2 }).map((_, index) => (
                            <div
                                key={index}
                                className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5"
                            >
                                <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
                                <div className="mt-4 h-8 w-48 animate-pulse rounded-2xl bg-white/10" />
                                <div className="mt-6 h-64 animate-pulse rounded-[1.3rem] bg-white/6" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    if (statusError && !status) {
        return (
            <section className="rounded-[1.75rem] border border-rose-400/25 bg-rose-950/40 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.28)] backdrop-blur">
                <div className="inline-flex rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200">
                    Connection issue
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-rose-50">
                    Backend unavailable
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-100/80">
                    Could not load server metrics. Check backend availability, API URL,
                    and CORS configuration.
                </p>
                <p className="mt-4 rounded-2xl border border-rose-300/14 bg-black/20 px-4 py-3 font-mono text-xs text-rose-100/75">
                    {statusError}
                </p>
            </section>
        );
    }

    return (
        <section className="space-y-4">
            {statusError ? (
                <div className="rounded-[1.35rem] border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100 shadow-[0_12px_30px_rgba(120,53,15,0.15)]">
                    Showing the last known snapshot. The most recent live refresh failed.
                </div>
            ) : null}
            {historyError ? (
                <div className="rounded-[1.35rem] border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100 shadow-[0_12px_30px_rgba(120,53,15,0.15)]">
                    Historical metrics could not be refreshed. The dashboard is showing the
                    last available one-hour window.
                </div>
            ) : null}

            {status ? (
                <StatusDashboard
                    status={status}
                    history={history}
                    historyStartUtc={historyWindow.startUtc}
                    historyEndUtc={historyWindow.endUtc}
                    historyIntervalSeconds={HISTORY_INTERVAL_SECONDS}
                />
            ) : null}
        </section>
    );
}

function getHistoryWindow() {
    const end = new Date();

    end.setSeconds(0, 0);

    return {
        startUtc: new Date(end.getTime() - HISTORY_WINDOW_MS).toISOString(),
        endUtc: end.toISOString(),
    };
}
