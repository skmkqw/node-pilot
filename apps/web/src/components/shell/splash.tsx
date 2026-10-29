"use client";

import { motion } from "motion/react";
import { Logo } from "@/components/ui/logo";

export function Splash({ message = "Connecting to your server…" }: { message?: string }) {
	return (
		<div className="grid min-h-screen place-items-center px-4">
			<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-5">
				<Logo size={64} />
				<div className="w-48 border-2 border-ink bg-surface p-1">
					<motion.div
						className="h-3 bg-ink"
						initial={{ width: "0%" }}
						animate={{ width: ["0%", "100%"] }}
						transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
					/>
				</div>
				<p className="label text-muted">{message}</p>
			</motion.div>
		</div>
	);
}
