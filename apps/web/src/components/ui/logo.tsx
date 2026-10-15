"use client";

import { motion } from "motion/react";
import { useId } from "react";

/**
 * NodePilot mark: a node graph inside a rounded hexagon. Paths draw themselves in on mount.
 */
export function Logo({ size = 36, animate = true }: { size?: number; animate?: boolean }) {
	const id = useId();
	const draw = animate
		? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 } }
		: {};

	return (
		<svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
			<defs>
				<linearGradient id={`${id}-stroke`} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
					<stop stopColor="#67e8f9" />
					<stop offset="0.55" stopColor="#818cf8" />
					<stop offset="1" stopColor="#c084fc" />
				</linearGradient>
				<radialGradient id={`${id}-fill`} cx="0" cy="0" r="1" gradientTransform="translate(24 20) rotate(90) scale(26)" gradientUnits="userSpaceOnUse">
					<stop stopColor="#22d3ee" stopOpacity="0.28" />
					<stop offset="1" stopColor="#6366f1" stopOpacity="0.04" />
				</radialGradient>
			</defs>
			<motion.path
				d="M21 3.7a6 6 0 0 1 6 0l13.6 7.85a6 6 0 0 1 3 5.2v15.7a6 6 0 0 1-3 5.2L27 45.3a6 6 0 0 1-6 0L7.4 37.45a6 6 0 0 1-3-5.2v-15.7a6 6 0 0 1 3-5.2L21 3.7Z"
				fill={`url(#${id}-fill)`}
				stroke={`url(#${id}-stroke)`}
				strokeWidth="2"
				transition={{ duration: 1.1, ease: "easeInOut" }}
				{...draw}
			/>
			<motion.path
				d="M16 31V17l16 14V17"
				stroke={`url(#${id}-stroke)`}
				strokeWidth="3"
				strokeLinecap="round"
				strokeLinejoin="round"
				transition={{ duration: 0.9, delay: 0.5, ease: "easeInOut" }}
				{...draw}
			/>
			{[
				[16, 17],
				[16, 31],
				[32, 17],
				[32, 31],
			].map(([cx, cy], index) => (
				<motion.circle
					key={`${cx}-${cy}`}
					cx={cx}
					cy={cy}
					r="3"
					fill="#e0f2fe"
					initial={animate ? { scale: 0 } : undefined}
					animate={animate ? { scale: 1 } : undefined}
					transition={{ delay: 1 + index * 0.08, type: "spring", stiffness: 400, damping: 15 }}
					style={{ transformOrigin: `${cx}px ${cy}px` }}
				/>
			))}
		</svg>
	);
}
