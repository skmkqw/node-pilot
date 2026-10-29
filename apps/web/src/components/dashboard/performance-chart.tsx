"use client";

import { AnimatePresence, motion } from "motion/react";
import { Activity } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { systemApi } from "@/lib/api/endpoints";
import type { IntervalMetricsSummary } from "@/lib/api/types";
import { formatDateTime, formatTime } from "@/lib/format";
import { usePolling } from "@/lib/use-polling";

type MetricKey = "cpu" | "ram" | "temp";
type RangeKey = "15m" | "1h" | "6h" | "24h";

const RANGES: Record<RangeKey, { label: string; windowMs: number; intervalSeconds: number }> = {
	"15m": { label: "15m", windowMs: 15 * 60_000, intervalSeconds: 15 },
	"1h": { label: "1h", windowMs: 60 * 60_000, intervalSeconds: 60 },
	"6h": { label: "6h", windowMs: 6 * 60 * 60_000, intervalSeconds: 300 },
	"24h": { label: "24h", windowMs: 24 * 60 * 60_000, intervalSeconds: 900 },
};

const METRIC_OPTIONS = [
	{ value: "cpu", label: "CPU" },
	{ value: "ram", label: "RAM" },
	{ value: "temp", label: "TEMP" },
] as const;

// Both percentages and CPU temperatures fit a 0–100 scale, so all three share one axis.
const METRICS: Record<MetricKey, { name: string; unit: string }> = {
	cpu: { name: "CPU usage", unit: "%" },
	ram: { name: "Memory usage", unit: "%" },
	temp: { name: "CPU temperature", unit: "°C" },
};

/** Minimum height; the chart grows to fill its card when the row is taller. */
const MIN_HEIGHT = 260;
const PADDING = { top: 14, right: 44, bottom: 28, left: 4 };

type Point = {
	time: number;
	avg: number | null;
	min: number | null;
	max: number | null;
	summary: IntervalMetricsSummary | null;
};

function pick(summary: IntervalMetricsSummary, metric: MetricKey) {
	switch (metric) {
		case "cpu":
			return { avg: summary.averageCpuUsagePercent, min: summary.minCpuUsagePercent, max: summary.maxCpuUsagePercent };
		case "ram":
			return { avg: summary.averageRamUsagePercent, min: summary.minRamUsagePercent, max: summary.maxRamUsagePercent };
		case "temp":
			return {
				avg: summary.averageCpuTemperatureCelsius,
				min: summary.minCpuTemperatureCelsius,
				max: summary.maxCpuTemperatureCelsius,
			};
	}
}

/** One point per expected bucket; buckets without samples stay null and break the line. */
function buildPoints(summaries: IntervalMetricsSummary[], metric: MetricKey, start: number, end: number, intervalMs: number): Point[] {
	const byStart = new Map(summaries.map((summary) => [new Date(summary.intervalStart).getTime(), summary]));
	const first = Math.floor(start / intervalMs) * intervalMs;
	const points: Point[] = [];

	for (let time = first; time < end; time += intervalMs) {
		const summary = byStart.get(time) ?? null;
		const values = summary ? pick(summary, metric) : { avg: null, min: null, max: null };
		points.push({ time, ...values, summary });
	}

	return points;
}

function segments(points: Point[]) {
	const result: Point[][] = [];
	let current: Point[] = [];

	for (const point of points) {
		if (point.avg === null) {
			if (current.length) result.push(current);
			current = [];
		} else {
			current.push(point);
		}
	}

	if (current.length) result.push(current);
	return result;
}

export function PerformanceChart() {
	const [metric, setMetric] = useState<MetricKey>("cpu");
	const [range, setRange] = useState<RangeKey>("1h");
	const [size, setSize] = useState({ width: 640, height: MIN_HEIGHT });
	const [hoverIndex, setHoverIndex] = useState<number | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const config = RANGES[range];
	const intervalMs = config.intervalSeconds * 1000;

	const history = usePolling(
		(signal) => {
			const end = new Date();
			const start = new Date(end.getTime() - config.windowMs);
			return systemApi
				.historical({ start, end, intervalSeconds: config.intervalSeconds }, signal)
				.then((summaries) => ({ summaries, start: start.getTime(), end: end.getTime() }));
		},
		Math.max(config.intervalSeconds * 1000, 15_000),
		[range],
	);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		const observer = new ResizeObserver(([entry]) =>
			setSize({ width: entry.contentRect.width, height: Math.max(entry.contentRect.height, MIN_HEIGHT) }),
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const points = useMemo(() => {
		if (!history.data) return [];
		return buildPoints(history.data.summaries, metric, history.data.start, history.data.end, intervalMs);
	}, [history.data, metric, intervalMs]);

	const { width, height } = size;
	const innerWidth = Math.max(width - PADDING.left - PADDING.right, 10);
	const innerHeight = height - PADDING.top - PADDING.bottom;
	const x = useCallback(
		(index: number) => PADDING.left + (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth),
		[points.length, innerWidth],
	);
	const y = (value: number) => PADDING.top + (1 - value / 100) * innerHeight;

	const pointIndex = new Map(points.map((point, index) => [point, index]));
	const lineSegments = segments(points);

	const measured = points.filter((point) => point.avg !== null);
	const average = measured.length ? measured.reduce((sum, point) => sum + point.avg!, 0) / measured.length : null;
	const peak = measured.length ? Math.max(...measured.map((point) => point.max ?? point.avg!)) : null;

	const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
		if (!points.length) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const relative = (event.clientX - rect.left - PADDING.left) / innerWidth;
		const index = Math.round(relative * (points.length - 1));
		setHoverIndex(Math.max(0, Math.min(points.length - 1, index)));
	};

	const hovered = hoverIndex !== null ? points[hoverIndex] : null;
	const drawKey = `${metric}-${range}`;
	const timeTicks = points.length ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (points.length - 1))) : [];
	const { name, unit } = METRICS[metric];

	const controls = (size: "sm" | "md") => (
		<>
			<Segmented label="Metric" size={size} value={metric} onChange={setMetric} options={METRIC_OPTIONS} />
			<Segmented
				label="Time range"
				size={size}
				value={range}
				onChange={setRange}
				options={(Object.keys(RANGES) as RangeKey[]).map((key) => ({ value: key, label: RANGES[key].label }))}
			/>
		</>
	);

	return (
		<Card className="flex h-full flex-col p-5 sm:p-6">
			<CardHeader
				icon={<Activity className="size-5" />}
				channel="CH-E / History"
				title="Performance"
				subtitle={
					average !== null ? (
						<span className="tabular">
							AVG {average.toFixed(1)}
							{unit} · PEAK {peak!.toFixed(1)}
							{unit} · LAST {config.label.toUpperCase()}
						</span>
					) : (
						`LAST ${config.label.toUpperCase()}`
					)
				}
				action={<div className="hidden flex-wrap justify-end gap-2 sm:flex">{controls("md")}</div>}
			/>

			<div className="mt-4 flex flex-wrap gap-2 sm:hidden">{controls("sm")}</div>

			<div ref={containerRef} className="relative mt-5 flex-1 border-2 border-ink bg-ground/40" style={{ minHeight: MIN_HEIGHT }}>
				{history.isLoading && !history.data ? (
					<div className="skeleton absolute inset-0 border-0" />
				) : (
					<svg
						width={width}
						height={height}
						className="absolute inset-0 touch-none select-none overflow-visible"
						onPointerMove={handlePointer}
						onPointerLeave={() => setHoverIndex(null)}
						role="img"
						aria-label={`${name} over the last ${config.label}`}
					>
						{[0, 25, 50, 75, 100].map((tick) => (
							<g key={tick}>
								<line
									x1={PADDING.left}
									x2={PADDING.left + innerWidth}
									y1={y(tick)}
									y2={y(tick)}
									stroke="var(--ink)"
									strokeOpacity={tick === 0 ? 1 : 0.18}
									strokeWidth={tick === 0 ? 2 : 1}
									strokeDasharray={tick === 0 ? undefined : "2 6"}
								/>
								<text x={PADDING.left + innerWidth + 8} y={y(tick) + 4} fontSize="11" fontFamily="var(--font-space-mono)" fill="var(--ink)" className="tabular">
									{tick}
									{unit}
								</text>
							</g>
						))}

						{timeTicks.map((index, position) => (
							<text
								key={`${index}-${position}`}
								x={x(index)}
								y={height - 8}
								fontSize="11"
								fontFamily="var(--font-space-mono)"
								fill="var(--ink)"
								textAnchor={position === 0 ? "start" : position === timeTicks.length - 1 ? "end" : "middle"}
								className="tabular"
							>
								{formatTime(new Date(points[index].time))}
							</text>
						))}

						<AnimatePresence mode="wait">
							<motion.g key={drawKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
								{lineSegments.map((segment, segmentIndex) => {
									const coords = segment.map((point) => [x(pointIndex.get(point)!), y(point.avg!)] as [number, number]);
									const line = coords.map(([px, py], i) => `${i === 0 ? "M" : "L"} ${px} ${py}`).join(" ");
									const area = `${line} L ${coords[coords.length - 1][0]} ${y(0)} L ${coords[0][0]} ${y(0)} Z`;
									const band =
										segment.length > 1 && segment.every((point) => point.min !== null && point.max !== null)
											? `${segment.map((point, i) => `${i === 0 ? "M" : "L"} ${x(pointIndex.get(point)!)} ${y(point.max!)}`).join(" ")} ${[...segment]
													.reverse()
													.map((point) => `L ${x(pointIndex.get(point)!)} ${y(point.min!)}`)
													.join(" ")} Z`
											: null;

									return (
										<g key={segmentIndex}>
											<motion.path
												d={area}
												fill="var(--accent)"
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												transition={{ duration: 0.4, delay: 0.5 }}
											/>
											{band ? <path d={band} fill="var(--ink)" fillOpacity="0.12" /> : null}
											<motion.path
												d={line}
												fill="none"
												stroke="var(--ink)"
												strokeWidth="3"
												strokeLinejoin="miter"
												initial={{ pathLength: 0 }}
												animate={{ pathLength: 1 }}
												transition={{ duration: 0.9, ease: "linear" }}
											/>
										</g>
									);
								})}
							</motion.g>
						</AnimatePresence>

						{hovered ? (
							<g pointerEvents="none">
								<line x1={x(hoverIndex!)} x2={x(hoverIndex!)} y1={PADDING.top} y2={y(0)} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="4 4" />
								{hovered.avg !== null ? (
									<rect x={x(hoverIndex!) - 6} y={y(hovered.avg) - 6} width="12" height="12" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.5" />
								) : null}
							</g>
						) : null}
					</svg>
				)}

				<AnimatePresence>
					{hovered ? (
						<motion.div
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.1 }}
							className="panel-sm pointer-events-none absolute top-2 z-10 w-52 p-3"
							style={{ left: Math.min(Math.max(x(hoverIndex!) - 104, 4), Math.max(width - 212, 4)) }}
						>
							<p className="label text-muted">{formatDateTime(new Date(hovered.time))}</p>
							{hovered.avg !== null ? (
								<>
									<p className="mt-1 text-2xl font-bold tabular">
										{hovered.avg.toFixed(1)}
										<span className="ml-1 font-mono text-xs">{unit} AVG</span>
									</p>
									<p className="font-mono text-xs tabular">
										{hovered.min?.toFixed(1)}–{hovered.max?.toFixed(1)}
										{unit} · {hovered.summary?.totalSamples} SAMPLES
									</p>
								</>
							) : (
								<p className="mt-1 font-mono text-xs font-bold">NO SAMPLES IN THIS INTERVAL</p>
							)}
						</motion.div>
					) : null}
				</AnimatePresence>

				{history.data && measured.length === 0 ? (
					<div className="label absolute inset-0 grid place-items-center px-6 text-center text-muted">
						{metric === "temp" && history.data.summaries.length > 0
							? "No temperature readings in this period — older samples were recorded before temperature history existed, or this machine has no sensor"
							: "Collecting data — the chart fills in as samples arrive"}
					</div>
				) : null}
			</div>
		</Card>
	);
}
