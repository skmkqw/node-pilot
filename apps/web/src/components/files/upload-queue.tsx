"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { Portal } from "@/components/ui/portal";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";

export type UploadItem = {
	id: number;
	name: string;
	size: number;
	progress: number;
	status: "uploading" | "done" | "error";
	error?: string;
	abort?: () => void;
};

const LED = { uploading: "bg-accent animate-blink", done: "bg-ok", error: "bg-alert" };

export function UploadQueue({ items, onDismiss }: { items: UploadItem[]; onDismiss: (id: number) => void }) {
	return (
		<Portal>
			<div className="pointer-events-none fixed bottom-28 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] lg:bottom-6 lg:right-6">
				<AnimatePresence>
					{items.length ? (
						<motion.div
							initial={{ opacity: 0, y: 24 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 24 }}
							transition={{ type: "spring", stiffness: 520, damping: 36 }}
							className="panel pointer-events-auto"
						>
							<p className="label border-b-2 border-ink bg-accent px-3 py-2">Upload queue · {items.length}</p>
							<ul className="divide-y-2 divide-ink/15">
								<AnimatePresence initial={false}>
									{items.map((item) => (
										<motion.li
											key={item.id}
											layout
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: "auto" }}
											exit={{ opacity: 0, height: 0 }}
											className="overflow-hidden"
										>
											<div className="px-3 py-2.5">
												<div className="flex items-center gap-2 text-xs">
													<span className={cn("led", LED[item.status])} />
													<span className="min-w-0 flex-1 truncate font-bold">{item.name}</span>
													<button
														type="button"
														aria-label={item.status === "uploading" ? "Cancel upload" : "Dismiss"}
														onClick={() => (item.status === "uploading" ? item.abort?.() : onDismiss(item.id))}
														className="grid size-7 place-items-center hover:bg-accent"
													>
														<X className="size-3.5" />
													</button>
												</div>
												<div className="mt-2 h-3 border-2 border-ink bg-surface p-[1px]">
													<motion.div
														className={cn("h-full", item.status === "error" ? "bg-alert" : "bg-ink")}
														animate={{ width: `${Math.round(item.progress * 100)}%` }}
														transition={{ type: "spring", stiffness: 200, damping: 28 }}
													/>
												</div>
												<p className="mt-1.5 font-mono text-[0.68rem] tabular text-muted">
													{item.status === "error"
														? item.error
														: `${formatBytes(item.size * item.progress)} / ${formatBytes(item.size)} · ${Math.round(item.progress * 100)}%`}
												</p>
											</div>
										</motion.li>
									))}
								</AnimatePresence>
							</ul>
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
		</Portal>
	);
}
