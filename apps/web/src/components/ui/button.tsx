"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type ButtonProps = HTMLMotionProps<"button"> & {
	variant?: "primary" | "secondary" | "ghost" | "danger";
	size?: "sm" | "md" | "lg" | "icon";
	isLoading?: boolean;
};

const variants = {
	primary: "border-2 border-ink bg-ink text-accent shadow-[4px_4px_0_var(--accent)]",
	secondary: "border-2 border-ink bg-surface text-ink shadow-[4px_4px_0_var(--ink)] hover:bg-accent",
	ghost: "border-2 border-transparent text-ink hover:border-ink hover:bg-surface",
	danger: "border-2 border-ink bg-danger text-white shadow-[4px_4px_0_var(--ink)]",
};

const sizes = {
	sm: "min-h-9 px-3 text-xs gap-1.5",
	md: "min-h-11 px-4 text-sm gap-2",
	lg: "min-h-12 px-5 text-sm gap-2",
	icon: "size-10",
};

/**
 * Hardware-style push button: pressing it moves it into its own shadow,
 * like a physical key going down.
 */
export function Button({
	variant = "secondary",
	size = "md",
	isLoading = false,
	disabled,
	className,
	children,
	...props
}: ButtonProps) {
	const hasShadow = variant !== "ghost";

	return (
		<motion.button
			whileTap={hasShadow ? { x: 3, y: 3, boxShadow: "1px 1px 0 var(--ink)" } : { scale: 0.97 }}
			transition={{ type: "spring", stiffness: 700, damping: 30 }}
			disabled={disabled || isLoading}
			className={cn(
				"relative inline-flex shrink-0 items-center justify-center font-mono font-bold uppercase tracking-wide transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50",
				variants[variant],
				sizes[size],
				className,
			)}
			{...props}
		>
			{isLoading ? <LoaderCircle className="size-4 animate-spin" /> : null}
			{children as React.ReactNode}
		</motion.button>
	);
}
