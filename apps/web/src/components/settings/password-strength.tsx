"use client";

import { motion } from "motion/react";

const LEVELS = [
	{ label: "Too short", color: "#fb7185" },
	{ label: "Weak", color: "#fb923c" },
	{ label: "Fair", color: "#fbbf24" },
	{ label: "Good", color: "#a3e635" },
	{ label: "Strong", color: "#34d399" },
];

/** Rough strength estimate: length plus character variety. Only guidance; the server enforces the minimum. */
export function scorePassword(password: string): number {
	if (password.length < 8) return 0;

	const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
	const lengthBonus = password.length >= 16 ? 2 : password.length >= 12 ? 1 : 0;

	return Math.max(1, Math.min(4, variety - 1 + lengthBonus));
}

export function PasswordStrength({ password }: { password: string }) {
	const score = scorePassword(password);
	const level = LEVELS[score];

	return (
		<div className="mt-2" aria-live="polite">
			<div className="flex gap-1">
				{LEVELS.slice(1).map((_, index) => (
					<div key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
						<motion.div
							className="h-full rounded-full"
							style={{ background: level.color, boxShadow: `0 0 8px ${level.color}` }}
							initial={false}
							animate={{ width: password && index < score ? "100%" : "0%" }}
							transition={{ type: "spring", stiffness: 300, damping: 30, delay: index * 0.04 }}
						/>
					</div>
				))}
			</div>
			{password ? (
				<p className="mt-1.5 text-xs" style={{ color: level.color }}>
					{level.label}
					{score === 0 ? " — at least 8 characters" : ""}
				</p>
			) : null}
		</div>
	);
}
