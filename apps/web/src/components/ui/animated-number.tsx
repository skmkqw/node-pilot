"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

type AnimatedNumberProps = {
	value: number | null | undefined;
	decimals?: number;
	className?: string;
	format?: (value: number) => string;
};

/**
 * Smoothly counts towards the latest value with a spring, so live metrics glide
 * instead of jumping on every refresh.
 */
export function AnimatedNumber({ value, decimals = 0, className, format }: AnimatedNumberProps) {
	const spring = useSpring(value ?? 0, { stiffness: 90, damping: 22, mass: 0.8 });
	const display = useTransform(spring, (current) =>
		format ? format(current) : current.toFixed(decimals),
	);

	useEffect(() => {
		if (value !== null && value !== undefined) {
			spring.set(value);
		}
	}, [spring, value]);

	if (value === null || value === undefined) {
		return <span className={className}>—</span>;
	}

	return <motion.span className={`tabular ${className ?? ""}`}>{display}</motion.span>;
}
