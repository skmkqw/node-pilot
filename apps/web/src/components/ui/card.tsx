"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/cn";

type CardProps = HTMLMotionProps<"div"> & {
	/** Highlighted plate (accent background), e.g. for a warning. */
	tone?: "default" | "accent";
};

/** A bordered plate with a hard offset shadow — the basic unit of the hardware-panel look. */
export function Card({ className, tone = "default", children, ...props }: CardProps) {
	return (
		<motion.div className={cn("panel", tone === "accent" && "bg-accent", className)} {...props}>
			{children}
		</motion.div>
	);
}

export function CardHeader({
	icon,
	title,
	subtitle,
	action,
	channel,
}: {
	icon?: React.ReactNode;
	title: string;
	subtitle?: React.ReactNode;
	action?: React.ReactNode;
	/** Small stencil label above the title, e.g. "CH-E". */
	channel?: string;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<div className="flex min-w-0 items-center gap-3">
				{icon ? (
					<div className="grid size-10 shrink-0 place-items-center border-2 border-ink bg-accent text-ink">{icon}</div>
				) : null}
				<div className="min-w-0">
					{channel ? <p className="label text-muted">{channel}</p> : null}
					<h3 className="truncate text-lg font-bold uppercase leading-tight tracking-tight text-ink">{title}</h3>
					{subtitle ? <p className="truncate font-mono text-xs text-muted">{subtitle}</p> : null}
				</div>
			</div>
			{action}
		</div>
	);
}
