"use client";

import { motion } from "motion/react";
import { Logo } from "@/components/ui/logo";

export function Splash({ message = "Connecting to your server…" }: { message?: string }) {
	return (
		<div className="grid min-h-screen place-items-center">
			<motion.div
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				className="flex flex-col items-center gap-5"
			>
				<div className="relative">
					<motion.div
						className="absolute -inset-6 rounded-full border border-cyan-300/20"
						animate={{ rotate: 360 }}
						transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
						style={{ borderTopColor: "rgba(103,232,249,0.8)" }}
					/>
					<Logo size={56} />
				</div>
				<p className="text-sm text-muted">{message}</p>
			</motion.div>
		</div>
	);
}
