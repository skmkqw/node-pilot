"use client";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { Severity } from "@/lib/format";

type MetricMeterProps = {
	channel: string;
	label: string;
	icon: React.ReactNode;
	value: number | null;
	/** Fill of the segment meter, 0–100. */
	percent: number | null;
	unit: string;
	decimals?: number;
	detail: React.ReactNode;
	severity: Severity;
	severityLabels?: Partial<Record<Severity, string>>;
	unavailableText?: string;
};

const SEGMENTS = 10;

const DEFAULT_LABELS: Record<Severity, string> = { ok: "Nominal", warn: "Elevated", critical: "Check" };

const LED: Record<Severity, string> = {
	ok: "bg-ok",
	warn: "bg-accent",
	critical: "bg-alert animate-blink",
};

export const meterVariants = {
	hidden: { opacity: 0, y: 16 },
	show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 420, damping: 34 } },
};

/**
 * One measurement channel: stencil label, status lamp, big reading and a 10-segment
 * meter that lights up one segment at a time. Critical readings switch the plate to saffron.
 */
export function MetricMeter({
	channel,
	label,
	icon,
	value,
	percent,
	unit,
	decimals = 0,
	detail,
	severity,
	severityLabels,
	unavailableText = "No data",
}: MetricMeterProps) {
	const available = value !== null && percent !== null;
	const lit = available ? Math.round((Math.max(0, Math.min(percent!, 100)) / 100) * SEGMENTS) : 0;
	const critical = available && severity === "critical";

	return (
		<Card variants={meterVariants} tone={critical ? "accent" : "default"} className="flex flex-col gap-4 p-4 sm:p-5">
			<div className="flex items-center justify-between gap-2">
				<span className="label flex min-w-0 items-center gap-2">
					{icon}
					<span className="truncate">
						{channel} / {label}
					</span>
				</span>
				<span className={cn("led", available ? LED[severity] : "bg-ground")} title={available ? severityLabels?.[severity] ?? DEFAULT_LABELS[severity] : undefined} />
			</div>

			{available ? (
				<span className="text-5xl font-bold leading-none tracking-tight sm:text-6xl">
					<AnimatedNumber value={value} decimals={decimals} />
					<span className="text-2xl">{unit}</span>
				</span>
			) : (
				<span className="text-2xl font-bold uppercase leading-[3rem] text-muted">{unavailableText}</span>
			)}

			<div className="grid grid-cols-10 gap-[3px]" role="meter" aria-label={label} aria-valuenow={percent ?? undefined} aria-valuemin={0} aria-valuemax={100}>
				{Array.from({ length: SEGMENTS }).map((_, index) => (
					<span key={index} className="relative h-3.5 border-[1.5px] border-ink">
						{/* A CSS transition always settles on the current value; a JS animation
						    interrupted mid-sweep (e.g. in a background tab) could leave stray segments lit. */}
						<span
							className={cn("absolute inset-0 bg-ink transition-opacity duration-75", index < lit ? "opacity-100" : "opacity-0")}
							style={{ transitionDelay: `${index < lit ? index * 45 : (SEGMENTS - index) * 20}ms` }}
						/>
					</span>
				))}
			</div>

			<div className="flex items-center justify-between gap-2 font-mono text-xs">
				<span className="truncate">{detail}</span>
				{available ? <span className="label shrink-0">{severityLabels?.[severity] ?? DEFAULT_LABELS[severity]}</span> : null}
			</div>
		</Card>
	);
}
