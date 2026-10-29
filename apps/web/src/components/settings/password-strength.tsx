"use client";

import { motion } from "motion/react";

const LEVELS = [
	{ label: "Too short", fill: "var(--alert)" },
	{ label: "Weak", fill: "var(--alert)" },
	{ label: "Fair", fill: "var(--accent)" },
	{ label: "Good", fill: "var(--ok)" },
	{ label: "Strong", fill: "var(--ink)" },
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
			<div className="grid grid-cols-4 gap-1">
				{LEVELS.slice(1).map((_, index) => (
					<div key={index} className="h-2.5 border-[1.5px] border-ink bg-surface">
						<motion.div
							className="h-full"
							style={{ background: level.fill }}
							initial={false}
							animate={{ width: password && index < score ? "100%" : "0%" }}
							transition={{ duration: 0.12, delay: index * 0.05 }}
						/>
					</div>
				))}
			</div>
			{password ? (
				<p className="label mt-1.5">
					{level.label}
					{score === 0 ? " — at least 8 characters" : ""}
				</p>
			) : null}
		</div>
	);
}
