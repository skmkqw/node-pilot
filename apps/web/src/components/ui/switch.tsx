"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

type SwitchProps = {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	label: string;
	size?: "md" | "lg";
};

/** Rocker-style toggle: a square knob that snaps between OFF and ON. */
export function Switch({ checked, onChange, disabled, label, size = "md" }: SwitchProps) {
	const large = size === "lg";

	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={cn(
				"relative flex shrink-0 items-center border-2 border-ink p-[3px] shadow-[3px_3px_0_var(--ink)] transition-colors duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50",
				large ? "h-10 w-[4.5rem]" : "h-8 w-14",
				checked ? "justify-end bg-ink" : "justify-start bg-surface",
			)}
		>
			<motion.span
				layout
				transition={{ type: "spring", stiffness: 800, damping: 35 }}
				className={cn("grid h-full place-items-center border-2 border-ink font-mono text-[0.6rem] font-bold", large ? "w-8" : "w-6", checked ? "bg-accent text-ink" : "bg-ground text-ink")}
			>
				{checked ? "I" : "O"}
			</motion.span>
		</button>
	);
}
