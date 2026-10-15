"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, TriangleAlert, Upload, X } from "lucide-react";
import { Portal } from "@/components/ui/portal";
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

export function UploadQueue({ items, onDismiss }: { items: UploadItem[]; onDismiss: (id: number) => void }) {
	return (
		<Portal>
			<div className="pointer-events-none fixed bottom-28 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] lg:bottom-6 lg:right-6">
				<AnimatePresence>
					{items.length ? (
						<motion.div
							initial={{ opacity: 0, y: 20, scale: 0.96 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 20, scale: 0.96 }}
							className="glass pointer-events-auto rounded-2xl p-3"
						>
							<p className="flex items-center gap-2 px-1 pb-2 text-xs font-medium text-slate-300">
								<Upload className="size-3.5 text-cyan-300" /> Uploads
							</p>
							<ul className="space-y-1.5">
								<AnimatePresence initial={false}>
									{items.map((item) => (
										<motion.li
											key={item.id}
											layout
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: "auto" }}
											exit={{ opacity: 0, height: 0 }}
											className="overflow-hidden rounded-xl bg-white/[0.03]"
										>
											<div className="px-3 py-2.5">
												<div className="flex items-center gap-2 text-xs">
													<span className="min-w-0 flex-1 truncate text-slate-200">{item.name}</span>
													{item.status === "done" ? <CircleCheck className="size-4 text-emerald-300" /> : null}
													{item.status === "error" ? <TriangleAlert className="size-4 text-rose-300" /> : null}
													<button
														type="button"
														aria-label={item.status === "uploading" ? "Cancel upload" : "Dismiss"}
														onClick={() => (item.status === "uploading" ? item.abort?.() : onDismiss(item.id))}
														className="text-slate-500 transition hover:text-white"
													>
														<X className="size-3.5" />
													</button>
												</div>
												<div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
													<motion.div
														className={
															item.status === "error"
																? "h-full bg-rose-400"
																: "h-full bg-gradient-to-r from-cyan-400 to-violet-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"
														}
														animate={{ width: `${Math.round(item.progress * 100)}%` }}
														transition={{ type: "spring", stiffness: 120, damping: 24 }}
													/>
												</div>
												<p className="mt-1.5 text-[0.68rem] text-slate-500 tabular">
													{item.status === "error"
														? item.error
														: `${formatBytes(item.size * item.progress)} of ${formatBytes(item.size)}`}
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
