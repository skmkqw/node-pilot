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

/** Pill-style tab switcher whose active background glides between options. */
export function Segmented<T extends string>({ value, onChange, options, size = "md", label }: SegmentedProps<T>) {
	const layoutId = useId();

	return (
		<div
			role="tablist"
			aria-label={label}
			className="inline-flex rounded-xl border border-white/8 bg-black/20 p-0.5"
		>
			{options.map((option) => {
				const active = option.value === value;

				return (
					<button
						key={option.value}
						role="tab"
						type="button"
						aria-selected={active}
						onClick={() => onChange(option.value)}
						className={cn(
							"relative rounded-[0.6rem] font-medium transition-colors",
							size === "sm" ? "px-2.5 py-1 text-[0.7rem]" : "px-3 py-1.5 text-xs",
							active ? "text-white" : "text-slate-400 hover:text-slate-200",
						)}
					>
						{active ? (
							<motion.span
								layoutId={layoutId}
								transition={{ type: "spring", stiffness: 500, damping: 36 }}
								className="absolute inset-0 rounded-[0.6rem] border border-white/10 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
							/>
						) : null}
						<span className="relative">{option.label}</span>
					</button>
				);
			})}
		</div>
	);
}
