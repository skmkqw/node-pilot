"use client";

import { useId, useState } from "react";
import { SystemMetricDto } from "@/types/system-metric";
import { buildHistorySeries, ChartPoint } from "./status-history";

type HistoricalMetricChartProps = {
    title: string;
    metric: "cpuUsagePercent" | "ramUsagePercent";
    description: string;
    accent: "cyan" | "emerald";
    history: SystemMetricDto[];
    startTimeUtc: string;
    endTimeUtc: string;
    intervalSeconds: number;
};

const themes = {
    cyan: {
        line: "#67e8f9",
        areaStart: "rgba(103,232,249,0.3)",
        areaEnd: "rgba(103,232,249,0.02)",
        point: "#ecfeff",
        failed: "#fda4af",
        missing: "#fbbf24",
        badge: "border-cyan-300/20 bg-cyan-400/10 text-cyan-100",
    },
    emerald: {
        line: "#6ee7b7",
        areaStart: "rgba(110,231,183,0.3)",
        areaEnd: "rgba(110,231,183,0.02)",
        point: "#ecfdf5",
        failed: "#fda4af",
        missing: "#fbbf24",
        badge: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
    },
} as const;

export function HistoricalMetricChart({
    title,
    metric,
    accent,
    history,
    startTimeUtc,
    endTimeUtc,
    intervalSeconds,
}: HistoricalMetricChartProps) {
    const gradientId = useId();
    const [hoveredBucketTime, setHoveredBucketTime] = useState<number | null>(null);

    const normalized = normalizeHistory(
        history,
        metric,
        startTimeUtc,
        endTimeUtc,
        intervalSeconds
    );
    const theme = themes[accent];
    const hoveredPoint =
        normalized.points.find(
            (point) => point.bucketTime.getTime() === hoveredBucketTime
        ) ?? null;

    return (
        <article className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,47,73,0.26),rgba(15,23,42,0.9)_32%,rgba(2,6,23,0.95))] p-5 shadow-[0_24px_65px_rgba(2,6,23,0.28)] backdrop-blur xl:p-6">
            <div className="max-w-2xl">
                <div
                    className={`inline-flex rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${theme.badge}`}
                >
                    {title}
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                    Last hour trend
                </h3>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-white/8 bg-slate-950/50 p-4">
                <div className="relative h-72 w-full">
                    <svg
                        viewBox="0 0 1000 360"
                        className="h-full w-full"
                        preserveAspectRatio="none"
                        role="img"
                        aria-label={`${title} history chart`}
                    >
                        <defs>
                            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor={theme.areaStart} />
                                <stop offset="100%" stopColor={theme.areaEnd} />
                            </linearGradient>
                        </defs>

                        {[0, 25, 50, 75, 100].map((tick) => {
                            const y = yForPercent(tick);

                            return (
                                <g key={tick}>
                                    <line
                                        x1="0"
                                        x2="1000"
                                        y1={y}
                                        y2={y}
                                        stroke="rgba(148,163,184,0.16)"
                                        strokeDasharray="6 10"
                                    />
                                    <text
                                        x="8"
                                        y={y - 8}
                                        fill="rgba(148,163,184,0.72)"
                                        fontSize="11"
                                    >
                                        {tick}%
                                    </text>
                                </g>
                            );
                        })}

                        {normalized.segments.map((segment, index) => (
                            <g key={`${title}-segment-${index}`}>
                                <path d={segment.areaPath} fill={`url(#${gradientId})`} />
                                <path
                                    d={segment.linePath}
                                    fill="none"
                                    stroke={theme.line}
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </g>
                        ))}

                        {normalized.points.map((point, index) => (
                            <g key={`${title}-${point.bucketTime.toISOString()}`}>
                                <line
                                    x1={point.x}
                                    x2={point.x}
                                    y1="20"
                                    y2="316"
                                    stroke={
                                        hoveredBucketTime === point.bucketTime.getTime()
                                            ? "rgba(226,232,240,0.22)"
                                            : "transparent"
                                    }
                                    strokeDasharray="4 8"
                                />
                                <rect
                                    x={hitAreaX(normalized.points, index)}
                                    y="0"
                                    width={hitAreaWidth(normalized.points, index)}
                                    height="330"
                                    fill="transparent"
                                    onMouseEnter={() =>
                                        setHoveredBucketTime(point.bucketTime.getTime())
                                    }
                                    onMouseLeave={() => setHoveredBucketTime(null)}
                                />
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={
                                        hoveredBucketTime === point.bucketTime.getTime()
                                            ? 7
                                            : 5
                                    }
                                    fill={fillForPoint(point, theme)}
                                    stroke="rgba(2,6,23,0.95)"
                                    strokeWidth="2.5"
                                />
                            </g>
                        ))}
                    </svg>

                    {hoveredPoint ? (
                        <div
                            className="pointer-events-none absolute top-3 z-10 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-sm shadow-[0_22px_45px_rgba(2,6,23,0.48)] backdrop-blur"
                            style={{ left: `${clampTooltipLeft(hoveredPoint.x)}%` }}
                        >
                            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
                                {title} sample
                            </p>
                            <p className="mt-2 font-semibold text-white">
                                {tooltipHeadline(title, hoveredPoint)}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-slate-300">
                                {formatTooltipTime(
                                    hoveredPoint.sample?.collectedAtUtc ??
                                        hoveredPoint.bucketTime.toISOString()
                                )}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-slate-400">
                                {tooltipDetail(hoveredPoint)}
                            </p>
                        </div>
                    ) : null}
                </div>

                <div className="mt-4 flex flex-col gap-3 text-[0.72rem] uppercase tracking-[0.18em] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>{formatAxisTime(startTimeUtc)}</span>
                    <div className="flex flex-wrap items-center gap-4">
                        <LegendSwatch color={theme.line} label="Successful" />
                        <LegendSwatch color={theme.failed} label="Failed" />
                        <LegendSwatch color={theme.missing} label="Missing" />
                    </div>
                    <span>{formatAxisTime(endTimeUtc)}</span>
                </div>
            </div>
        </article>
    );
}

function normalizeHistory(
    history: SystemMetricDto[],
    metric: "cpuUsagePercent" | "ramUsagePercent",
    startTimeUtc: string,
    endTimeUtc: string,
    intervalSeconds: number
) {
    const { points } = buildHistorySeries(
        history,
        metric,
        startTimeUtc,
        endTimeUtc,
        intervalSeconds
    );
    const segments = segmentSuccessfulPoints(points);

    return {
        points,
        segments: segments.map((segment) => ({
            linePath: pathForPoints(segment),
            areaPath: areaPathForPoints(segment),
        })),
    };
}

function segmentSuccessfulPoints(points: ChartPoint[]) {
    const segments: ChartPoint[][] = [];
    let currentSegment: ChartPoint[] = [];

    for (const point of points) {
        if (point.state === "success") {
            currentSegment.push(point);
            continue;
        }

        if (currentSegment.length > 0) {
            segments.push(currentSegment);
            currentSegment = [];
        }
    }

    if (currentSegment.length > 0) {
        segments.push(currentSegment);
    }

    return segments.filter((segment) => segment.length > 0);
}

function pathForPoints(points: ChartPoint[]) {
    return points
        .map((point, index) =>
            `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
        )
        .join(" ");
}

function areaPathForPoints(points: ChartPoint[]) {
    if (points.length === 0) {
        return "";
    }

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    return `${pathForPoints(points)} L ${lastPoint.x.toFixed(2)} 314 L ${firstPoint.x.toFixed(2)} 314 Z`;
}

function yForPercent(value: number) {
    return 24 + (1 - value / 100) * 276;
}

function fillForPoint(
    point: ChartPoint,
    theme: (typeof themes)[keyof typeof themes]
) {
    if (point.state === "failed") {
        return theme.failed;
    }

    if (point.state === "missing") {
        return theme.missing;
    }

    return theme.point;
}

function hitAreaWidth(points: ChartPoint[], index: number) {
    if (points.length === 1) {
        return 1000;
    }

    if (index === 0) {
        return Math.max((points[index + 1].x - points[index].x) / 2, 12);
    }

    if (index === points.length - 1) {
        return Math.max((points[index].x - points[index - 1].x) / 2, 12);
    }

    return Math.max((points[index + 1].x - points[index - 1].x) / 2, 12);
}

function hitAreaX(points: ChartPoint[], index: number) {
    return points[index].x - hitAreaWidth(points, index) / 2;
}

function clampTooltipLeft(x: number) {
    return Math.max(15, Math.min(85, x / 10));
}

function tooltipHeadline(title: string, point: ChartPoint) {
    if (point.state === "missing") {
        return "Missing interval";
    }

    if (point.state === "failed") {
        return "Metric read failed";
    }

    return `${point.value?.toFixed(2)}% ${title.toLowerCase()}`;
}

function tooltipDetail(point: ChartPoint) {
    if (!point.sample) {
        return "No sample was returned for this expected one-minute interval.";
    }

    if (point.sample.status === 1) {
        return point.sample.failureReason ?? "The backend marked this metric read as unsuccessful.";
    }

    return `Sample #${point.sample.id}. CPU ${formatPercent(point.sample.cpuUsagePercent)}. RAM ${formatPercent(point.sample.ramUsagePercent)}.`;
}

function formatPercent(value: number | null) {
    return value === null ? "n/a" : `${value.toFixed(2)}%`;
}

function formatTooltipTime(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(new Date(value));
}

function formatAxisTime(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
            />
            <span>{label}</span>
        </div>
    );
}
