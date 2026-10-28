"use client";

import { motion } from "motion/react";
import { RefreshCw, ServerOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="grid min-h-screen place-items-center px-4">
			<motion.div
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				className="glass flex max-w-md flex-col items-center rounded-[2rem] p-8 text-center"
			>
				<div className="grid size-14 place-items-center rounded-2xl border border-rose-300/20 bg-rose-500/10 text-rose-300 shadow-[0_0_40px_-10px_rgba(244,63,94,0.8)]">
					<ServerOff className="size-6" />
				</div>
				<h1 className="mt-5 text-xl font-semibold text-white">Can&apos;t reach the server</h1>
				<p className="mt-2 text-sm leading-6 text-muted">
					The NodePilot backend is not responding. Make sure it is running on port 5000 of this host.
				</p>
				<Button variant="primary" className="mt-6" onClick={onRetry}>
					<RefreshCw className="size-4" /> Try again
				</Button>
			</motion.div>
		</div>
	);
}
