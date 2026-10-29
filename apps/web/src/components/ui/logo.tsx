"use client";

import { motion } from "motion/react";

/**
 * NodePilot mark: a square unit badge with the "N" node graph. The lines draw in and the
 * status lamp lights up on mount.
 */
export function Logo({ size = 36, animate = true }: { size?: number; animate?: boolean }) {
	const draw = animate ? { initial: { pathLength: 0 }, animate: { pathLength: 1 } } : {};

	return (
		<svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
			<rect x="5" y="5" width="40" height="40" fill="var(--ink)" />
			<rect x="2" y="2" width="40" height="40" fill="var(--accent)" stroke="var(--ink)" strokeWidth="2.5" />
			<motion.path
				d="M13 32V13l17 19V13"
				stroke="var(--ink)"
				strokeWidth="4"
				strokeLinecap="square"
				strokeLinejoin="miter"
				transition={{ duration: 0.7, ease: "easeInOut" }}
				{...draw}
			/>
			{[
				[13, 13],
				[13, 32],
				[30, 13],
				[30, 32],
			].map(([x, y], index) => (
				<motion.rect
					key={`${x}-${y}`}
					x={x - 3}
					y={y - 3}
					width="6"
					height="6"
					fill="var(--surface)"
					stroke="var(--ink)"
					strokeWidth="2"
					initial={animate ? { scale: 0 } : undefined}
					animate={animate ? { scale: 1 } : undefined}
					transition={{ delay: 0.6 + index * 0.07, type: "spring", stiffness: 600, damping: 18 }}
					style={{ transformOrigin: `${x}px ${y}px` }}
				/>
			))}
			<motion.rect
				x="34"
				y="35"
				width="5"
				height="5"
				fill="var(--ok)"
				initial={animate ? { opacity: 0 } : undefined}
				animate={animate ? { opacity: 1 } : undefined}
				transition={{ delay: 1 }}
			/>
		</svg>
	);
}
