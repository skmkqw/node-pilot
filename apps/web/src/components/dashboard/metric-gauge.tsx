"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect, useId } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Card } from "@/components/ui/card";
import type { Severity } from "@/lib/format";
import { cn } from "@/lib/cn";

type MetricGaugeProps = {
	label: string;
	icon: React.ReactNode;
	/** Value to display in the centre (e.g. °C or %). */
	value: number | null;
	/** Fill of the arc in percent (0–100). */
	percent: number | null;
	unit: string;
	decimals?: number;
	color: string;
	colorTo: string;
	detail: React.ReactNode;
	severity: Severity;
	severityLabels?: Partial<Record<Severity, string>>;
	unavailableText?: string;
};

const SIZE = 168;
const CENTER = SIZE / 2;
const RADIUS = 64;
const START_ANGLE = 135;
const SWEEP = 270;
const TICKS = 36;

const DEFAULT_LABELS: Record<Severity, string> = {
	ok: "Healthy",
	warn: "Elevated",
	critical: "Critical",
};

const SEVERITY_DOTS: Record<Severity, string> = {
	ok: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]",
	warn: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]",
	critical: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]",
};

const SEVERITY_STYLES: Record<Severity, string> = {
	ok: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
	warn: "border-amber-300/25 bg-amber-400/10 text-amber-200",
	critical: "border-rose-300/30 bg-rose-500/15 text-rose-200",
};

function polar(angleDeg: number, radius: number) {
	const angle = (angleDeg * Math.PI) / 180;
	return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}

function arcPath(radius: number) {
	const start = polar(START_ANGLE, radius);
	const end = polar(START_ANGLE + SWEEP, radius);
	return `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${end.x} ${end.y}`;
}

export function MetricGauge({
	label,
	icon,
	value,
	percent,
	unit,
	decimals = 0,
	color,
	colorTo,
	detail,
	severity,
	severityLabels,
	unavailableText = "Unavailable",
}: MetricGaugeProps) {
	const id = useId();
	const available = value !== null && percent !== null;
	const fraction = useSpring(0, { stiffness: 60, damping: 18 });

	useEffect(() => {
		fraction.set(available ? Math.max(0, Math.min(percent!, 100)) / 100 : 0);
	}, [fraction, percent, available]);

	const knobX = useTransform(fraction, (f) => polar(START_ANGLE + SWEEP * f, RADIUS).x);
	const knobY = useTransform(fraction, (f) => polar(START_ANGLE + SWEEP * f, RADIUS).y);
	const litTicks = Math.round(((percent ?? 0) / 100) * TICKS);

	return (
		<Card glow={color} className="p-5" variants={gaugeVariants}>
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-slate-200">
					<span
						className="grid size-8 place-items-center rounded-xl border border-white/10"
						style={{ color, background: `color-mix(in oklab, ${color} 14%, transparent)` }}
					>
						{icon}
					</span>
					<span className="truncate">{label}</span>
				</div>
				{available ? (
					<span
						aria-hidden
						className={cn("size-2 shrink-0 rounded-full transition-colors duration-500 sm:hidden", SEVERITY_DOTS[severity])}
					/>
				) : null}
				{available ? (
					<span
						className={cn(
							"hidden shrink-0 rounded-full border px-2 py-0.5 sm:inline text-[0.65rem] font-semibold uppercase tracking-[0.14em] transition-colors duration-500",
							SEVERITY_STYLES[severity],
						)}
					>
						{severityLabels?.[severity] ?? DEFAULT_LABELS[severity]}
					</span>
				) : null}
			</div>

			<div className="relative mx-auto mt-2 aspect-square w-full max-w-[11rem]">
				<svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full overflow-visible">
					<defs>
						<linearGradient id={`${id}-arc`} x1="0" y1="1" x2="1" y2="0">
							<stop offset="0%" stopColor={color} />
							<stop offset="100%" stopColor={colorTo} />
						</linearGradient>
						<filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
							<feGaussianBlur stdDeviation="4" result="blur" />
							<feMerge>
								<feMergeNode in="blur" />
								<feMergeNode in="SourceGraphic" />
							</feMerge>
						</filter>
					</defs>

					{Array.from({ length: TICKS + 1 }).map((_, index) => {
						const angle = START_ANGLE + (SWEEP / TICKS) * index;
						const outer = polar(angle, RADIUS + 15);
						const inner = polar(angle, RADIUS + (index % 6 === 0 ? 9 : 11));
						const lit = available && index <= litTicks;

						return (
							<line
								key={index}
								x1={inner.x}
								y1={inner.y}
								x2={outer.x}
								y2={outer.y}
								stroke={lit ? color : "rgba(148,163,184,0.18)"}
								strokeOpacity={lit ? 0.55 + (index / TICKS) * 0.45 : 1}
								strokeWidth={index % 6 === 0 ? 1.6 : 1}
								strokeLinecap="round"
								style={{ transition: "stroke 400ms ease, stroke-opacity 400ms ease" }}
							/>
						);
					})}

					<path d={arcPath(RADIUS)} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="10" strokeLinecap="round" />

					<motion.path
						d={arcPath(RADIUS)}
						fill="none"
						stroke={`url(#${id}-arc)`}
						strokeWidth="10"
						strokeLinecap="round"
						filter={`url(#${id}-glow)`}
						style={{ pathLength: fraction }}
						initial={false}
						animate={{ opacity: available ? 1 : 0 }}
					/>

					{available ? (
						<motion.circle cx={knobX} cy={knobY} r="7" fill="#fff" filter={`url(#${id}-glow)`} stroke={colorTo} strokeWidth="3" />
					) : null}
				</svg>

				<div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
					{available ? (
						<>
							<div className="flex items-baseline gap-0.5">
								<AnimatedNumber value={value} decimals={decimals} className="text-4xl font-semibold tracking-tight text-white" />
								<span className="text-sm font-medium text-slate-400">{unit}</span>
							</div>
						</>
					) : (
						<span className="text-sm text-slate-500">{unavailableText}</span>
					)}
				</div>
			</div>

			<div className="-mt-3 text-center text-xs text-muted">{detail}</div>
		</Card>
	);
}

export const gaugeVariants = {
	hidden: { opacity: 0, y: 18, scale: 0.97 },
	show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 260, damping: 26 } },
};
