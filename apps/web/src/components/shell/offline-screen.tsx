"use client";

import { motion } from "motion/react";
import { RefreshCw, ServerOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="grid min-h-screen place-items-center px-4">
			<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="panel flex max-w-md flex-col items-center p-8 text-center">
				<div className="flex items-center gap-3">
					<span className="led animate-blink bg-alert" />
					<span className="label">Link down</span>
				</div>
				<div className="mt-5 grid size-14 place-items-center border-2 border-ink bg-alert">
					<ServerOff className="size-6" />
				</div>
				<h1 className="mt-5 text-2xl font-bold uppercase">Can&apos;t reach the server</h1>
				<p className="mt-2 font-mono text-sm leading-6 text-muted">
					The NodePilot backend is not responding. Make sure it is running on port 5000 of this host.
				</p>
				<Button variant="primary" className="mt-6" onClick={onRetry}>
					<RefreshCw className="size-4" /> Try again
				</Button>
			</motion.div>
		</div>
	);
}
