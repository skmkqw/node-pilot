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
	primary:
		"text-slate-950 bg-gradient-to-b from-cyan-300 to-sky-400 shadow-[0_8px_30px_-8px_rgba(34,211,238,0.7),inset_0_1px_0_rgba(255,255,255,0.5)] hover:from-cyan-200 hover:to-sky-300",
	secondary:
		"text-slate-100 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] hover:border-white/20",
	ghost: "text-slate-300 hover:text-white hover:bg-white/[0.06]",
	danger:
		"text-white bg-gradient-to-b from-rose-500 to-rose-600 shadow-[0_8px_30px_-10px_rgba(244,63,94,0.8),inset_0_1px_0_rgba(255,255,255,0.25)] hover:from-rose-400 hover:to-rose-500",
};

const sizes = {
	sm: "h-8 px-3 text-xs gap-1.5 rounded-xl",
	md: "h-10 px-4 text-sm gap-2 rounded-xl",
	lg: "h-12 px-5 text-sm gap-2 rounded-2xl",
	icon: "size-9 rounded-xl",
};

export function Button({
	variant = "secondary",
	size = "md",
	isLoading = false,
	disabled,
	className,
	children,
	...props
}: ButtonProps) {
	return (
		<motion.button
			whileTap={{ scale: 0.96 }}
			transition={{ type: "spring", stiffness: 500, damping: 30 }}
			disabled={disabled || isLoading}
			className={cn(
				"relative inline-flex shrink-0 items-center justify-center font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-50",
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
