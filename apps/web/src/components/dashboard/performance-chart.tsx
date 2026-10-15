"use client";

import { AnimatePresence, motion } from "motion/react";
import { Activity } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { systemApi } from "@/lib/api/endpoints";
import type { IntervalMetricsSummary } from "@/lib/api/types";
import { formatDateTime, formatTime } from "@/lib/format";
import { usePolling } from "@/lib/use-polling";

type MetricKey = "cpu" | "ram";
type RangeKey = "15m" | "1h" | "6h" | "24h";

const RANGES: Record<RangeKey, { label: string; windowMs: number; intervalSeconds: number }> = {
	"15m": { label: "15m", windowMs: 15 * 60_000, intervalSeconds: 15 },
	"1h": { label: "1h", windowMs: 60 * 60_000, intervalSeconds: 60 },
	"6h": { label: "6h", windowMs: 6 * 60 * 60_000, intervalSeconds: 300 },
	"24h": { label: "24h", windowMs: 24 * 60 * 60_000, intervalSeconds: 900 },
};

const METRICS: Record<MetricKey, { label: string; color: string; colorTo: string }> = {
	cpu: { label: "CPU", color: "#22d3ee", colorTo: "#38bdf8" },
	ram: { label: "Memory", color: "#a78bfa", colorTo: "#c084fc" },
};

const HEIGHT = 260;
const PADDING = { top: 16, right: 40, bottom: 28, left: 8 };

type Point = {
	time: number;
	avg: number | null;
	min: number | null;
	max: number | null;
	summary: IntervalMetricsSummary | null;
};

function pick(summary: IntervalMetricsSummary, metric: MetricKey) {
	return metric === "cpu"
		? { avg: summary.averageCpuUsagePercent, min: summary.minCpuUsagePercent, max: summary.maxCpuUsagePercent }
		: { avg: summary.averageRamUsagePercent, min: summary.minRamUsagePercent, max: summary.maxRamUsagePercent };
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

/** Smooth line through points using a monotone-ish cubic (Catmull-Rom → Bézier). */
function smoothPath(coords: Array<[number, number]>) {
	if (coords.length === 0) return "";
	if (coords.length === 1) return `M ${coords[0][0]} ${coords[0][1]} h 0.01`;

	let d = `M ${coords[0][0]} ${coords[0][1]}`;

	for (let index = 0; index < coords.length - 1; index++) {
		const [x0, y0] = coords[index - 1] ?? coords[index];
		const [x1, y1] = coords[index];
		const [x2, y2] = coords[index + 1];
		const [x3, y3] = coords[index + 2] ?? coords[index + 1];
		const tension = 0.18;

		const c1x = x1 + (x2 - x0) * tension;
		const c1y = y1 + (y2 - y0) * tension;
		const c2x = x2 - (x3 - x1) * tension;
		const c2y = y2 - (y3 - y1) * tension;

		d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
	}

	return d;
}

export function PerformanceChart() {
	const [metric, setMetric] = useState<MetricKey>("cpu");
	const [range, setRange] = useState<RangeKey>("1h");
	const [width, setWidth] = useState(640);
	const [hoverIndex, setHoverIndex] = useState<number | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const gradientId = useId();

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

		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const points = useMemo(() => {
		if (!history.data) return [];
		return buildPoints(history.data.summaries, metric, history.data.start, history.data.end, intervalMs);
	}, [history.data, metric, intervalMs]);

	const innerWidth = Math.max(width - PADDING.left - PADDING.right, 10);
	const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
	const x = useCallback(
		(index: number) => PADDING.left + (points.length <= 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth),
		[points.length, innerWidth],
	);
	const y = (value: number) => PADDING.top + (1 - value / 100) * innerHeight;

	const pointIndex = new Map(points.map((point, index) => [point, index]));
	const lineSegments = segments(points);
	const colors = METRICS[metric];

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

	return (
		<Card glow={colors.color} className="flex h-full flex-col p-5 sm:p-6">
			<CardHeader
				icon={<Activity className="size-5" />}
				accent={colors.color}
				title="Performance"
				subtitle={
					average !== null ? (
						<span className="tabular">
							avg <span className="text-slate-200">{average.toFixed(1)}%</span> · peak{" "}
							<span className="text-slate-200">{peak!.toFixed(1)}%</span> · last {config.label}
						</span>
					) : (
						`Last ${config.label}`
					)
				}
				action={
					<div className="hidden flex-wrap justify-end gap-2 sm:flex">
						<Segmented
							label="Metric"
							value={metric}
							onChange={setMetric}
							options={[
								{ value: "cpu", label: "CPU" },
								{ value: "ram", label: "Memory" },
							]}
						/>
						<Segmented
							label="Time range"
							value={range}
							onChange={setRange}
							options={(Object.keys(RANGES) as RangeKey[]).map((key) => ({ value: key, label: RANGES[key].label }))}
						/>
					</div>
				}
			/>

			<div className="mt-4 flex flex-wrap gap-2 sm:hidden">
				<Segmented label="Metric" size="sm" value={metric} onChange={setMetric} options={[{ value: "cpu", label: "CPU" }, { value: "ram", label: "Memory" }]} />
				<Segmented label="Time range" size="sm" value={range} onChange={setRange} options={(Object.keys(RANGES) as RangeKey[]).map((key) => ({ value: key, label: RANGES[key].label }))} />
			</div>

			<div ref={containerRef} className="relative mt-5 flex-1" style={{ minHeight: HEIGHT }}>
				{history.isLoading && !history.data ? (
					<div className="skeleton absolute inset-0 rounded-2xl" />
				) : (
					<svg
						width={width}
						height={HEIGHT}
						className="absolute inset-0 touch-none select-none overflow-visible"
						onPointerMove={handlePointer}
						onPointerLeave={() => setHoverIndex(null)}
						role="img"
						aria-label={`${colors.label} usage over the last ${config.label}`}
					>
						<defs>
							<linearGradient id={`${gradientId}-area`} x1="0" x2="0" y1="0" y2="1">
								<stop offset="0%" stopColor={colors.color} stopOpacity="0.35" />
								<stop offset="100%" stopColor={colors.color} stopOpacity="0" />
							</linearGradient>
							<linearGradient id={`${gradientId}-line`} x1="0" x2="1" y1="0" y2="0">
								<stop offset="0%" stopColor={colors.color} />
								<stop offset="100%" stopColor={colors.colorTo} />
							</linearGradient>
							<filter id={`${gradientId}-glow`} x="-10%" y="-30%" width="120%" height="160%">
								<feGaussianBlur stdDeviation="5" result="blur" />
								<feMerge>
									<feMergeNode in="blur" />
									<feMergeNode in="SourceGraphic" />
								</feMerge>
							</filter>
						</defs>

						{[0, 25, 50, 75, 100].map((tick) => (
							<g key={tick}>
								<line
									x1={PADDING.left}
									x2={PADDING.left + innerWidth}
									y1={y(tick)}
									y2={y(tick)}
									stroke="rgba(148,163,184,0.1)"
									strokeDasharray={tick === 0 ? undefined : "3 6"}
								/>
								<text x={PADDING.left + innerWidth + 8} y={y(tick) + 4} fontSize="10" fill="rgba(148,163,184,0.6)" className="tabular">
									{tick}%
								</text>
							</g>
						))}

						{timeTicks.map((index, position) => (
							<text
								key={`${index}-${position}`}
								x={x(index)}
								y={HEIGHT - 6}
								fontSize="10"
								fill="rgba(148,163,184,0.6)"
								textAnchor={position === 0 ? "start" : position === timeTicks.length - 1 ? "end" : "middle"}
								className="tabular"
							>
								{formatTime(new Date(points[index].time))}
							</text>
						))}

						<AnimatePresence mode="wait">
							<motion.g key={drawKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
								{lineSegments.map((segment, segmentIndex) => {
									const coords = segment.map((point) => [x(pointIndex.get(point)!), y(point.avg!)] as [number, number]);
									const line = smoothPath(coords);
									const area = `${line} L ${coords[coords.length - 1][0]} ${y(0)} L ${coords[0][0]} ${y(0)} Z`;
									const band =
										segment.every((point) => point.min !== null && point.max !== null) && segment.length > 1
											? `${segment
													.map((point, i) => `${i === 0 ? "M" : "L"} ${x(pointIndex.get(point)!)} ${y(point.max!)}`)
													.join(" ")} ${[...segment]
													.reverse()
													.map((point) => `L ${x(pointIndex.get(point)!)} ${y(point.min!)}`)
													.join(" ")} Z`
											: null;

									return (
										<g key={segmentIndex}>
											<motion.path
												d={area}
												fill={`url(#${gradientId}-area)`}
												initial={{ opacity: 0 }}
												animate={{ opacity: 1 }}
												transition={{ duration: 0.8, delay: 0.3 }}
											/>
											{band ? <path d={band} fill={colors.color} fillOpacity="0.08" /> : null}
											<motion.path
												d={line}
												fill="none"
												stroke={`url(#${gradientId}-line)`}
												strokeWidth="2.5"
												strokeLinecap="round"
												strokeLinejoin="round"
												filter={`url(#${gradientId}-glow)`}
												initial={{ pathLength: 0 }}
												animate={{ pathLength: 1 }}
												transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
											/>
										</g>
									);
								})}
							</motion.g>
						</AnimatePresence>

						{hovered ? (
							<g pointerEvents="none">
								<line
									x1={x(hoverIndex!)}
									x2={x(hoverIndex!)}
									y1={PADDING.top}
									y2={y(0)}
									stroke="rgba(226,232,240,0.25)"
									strokeDasharray="3 4"
								/>
								{hovered.avg !== null ? (
									<motion.circle
										initial={{ r: 0 }}
										animate={{ r: 5 }}
										cx={x(hoverIndex!)}
										cy={y(hovered.avg)}
										fill="#fff"
										stroke={colors.color}
										strokeWidth="3"
									/>
								) : null}
							</g>
						) : null}
					</svg>
				)}

				<AnimatePresence>
					{hovered ? (
						<motion.div
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="glass pointer-events-none absolute top-0 z-10 w-48 rounded-2xl p-3 text-xs"
							style={{
								left: Math.min(Math.max(x(hoverIndex!) - 96, 0), Math.max(width - 192, 0)),
							}}
						>
							<p className="text-[0.68rem] uppercase tracking-[0.16em] text-slate-400">{formatDateTime(new Date(hovered.time))}</p>
							{hovered.avg !== null ? (
								<>
									<p className="mt-1.5 text-lg font-semibold text-white tabular">
										{hovered.avg.toFixed(1)}
										<span className="ml-0.5 text-xs text-slate-400">% avg</span>
									</p>
									<p className="mt-0.5 text-slate-400 tabular">
										range {hovered.min?.toFixed(1)}–{hovered.max?.toFixed(1)}% · {hovered.summary?.totalSamples} samples
									</p>
								</>
							) : (
								<p className="mt-1.5 text-amber-200/90">No samples in this interval</p>
							)}
						</motion.div>
					) : null}
				</AnimatePresence>

				{history.data && measured.length === 0 ? (
					<div className="absolute inset-0 grid place-items-center text-sm text-muted">
						Collecting data — the chart fills in as samples arrive.
					</div>
				) : null}
			</div>
		</Card>
	);
}
