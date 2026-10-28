"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/cn";

type SegmentedProps<T extends string> = {
	value: T;
	onChange: (value: T) => void;
	options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
	size?: "sm" | "md";
	label: string;
};

/** Row of selector keys; the active one is "pressed in" (ink background). */
export function Segmented<T extends string>({ value, onChange, options, size = "md", label }: SegmentedProps<T>) {
	const layoutId = useId();

	return (
		<div role="tablist" aria-label={label} className="inline-flex border-2 border-ink bg-surface">
			{options.map((option, index) => {
				const active = option.value === value;

				return (
					<button
						key={option.value}
						role="tab"
						type="button"
						aria-selected={active}
						onClick={() => onChange(option.value)}
						className={cn(
							"relative font-mono font-bold uppercase transition-colors",
							index > 0 && "border-l-2 border-ink",
							size === "sm" ? "min-h-8 px-2.5 text-[0.7rem]" : "min-h-9 px-3 text-xs",
							active ? "text-accent" : "text-ink hover:bg-accent",
						)}
					>
						{active ? (
							<motion.span layoutId={layoutId} transition={{ type: "spring", stiffness: 700, damping: 40 }} className="absolute inset-0 bg-ink" />
						) : null}
						<span className="relative">{option.label}</span>
					</button>
				);
			})}
		</div>
	);
}
