"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { useCallback } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLMotionProps<"div"> & {
	/** Colour of the cursor-following highlight. */
	glow?: string;
};

export function Card({ className, glow = "#ffffff", style, onMouseMove, children, ...props }: CardProps) {
	const handleMouseMove = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			const rect = event.currentTarget.getBoundingClientRect();
			event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
			event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
			onMouseMove?.(event);
		},
		[onMouseMove],
	);

	return (
		<motion.div
			className={cn("glass spotlight overflow-hidden rounded-3xl", className)}
			style={{ ...style, ["--spot-color" as string]: glow }}
			onMouseMove={handleMouseMove}
			{...props}
		>
			{children}
		</motion.div>
	);
}

export function CardHeader({
	icon,
	title,
	subtitle,
	action,
	accent,
}: {
	icon?: React.ReactNode;
	title: string;
	subtitle?: React.ReactNode;
	action?: React.ReactNode;
	accent?: string;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<div className="flex min-w-0 items-center gap-3">
				{icon ? (
					<div
						className="grid size-10 shrink-0 place-items-center rounded-2xl border border-white/10"
						style={{
							color: accent,
							background: accent
								? `linear-gradient(135deg, color-mix(in oklab, ${accent} 22%, transparent), color-mix(in oklab, ${accent} 4%, transparent))`
								: undefined,
							boxShadow: accent ? `0 0 24px -6px ${accent}` : undefined,
						}}
					>
						{icon}
					</div>
				) : null}
				<div className="min-w-0">
					<h3 className="truncate text-sm font-semibold tracking-tight text-white">{title}</h3>
					{subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
				</div>
			</div>
			{action}
		</div>
	);
}
