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
				"relative flex shrink-0 items-center rounded-full border p-1 transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-50",
				large ? "h-9 w-16" : "h-7 w-12",
				checked
					? "justify-end border-emerald-300/30 bg-emerald-400/80 shadow-[0_0_24px_-4px_rgba(52,211,153,0.8)]"
					: "justify-start border-white/10 bg-white/[0.08]",
			)}
		>
			<motion.span
				layout
				transition={{ type: "spring", stiffness: 600, damping: 32 }}
				className={cn(
					"block rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
					large ? "size-7" : "size-5",
				)}
			/>
		</button>
	);
}
