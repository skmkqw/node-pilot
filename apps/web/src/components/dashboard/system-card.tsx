"use client";

import { motion } from "motion/react";
import { Server } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import type { SystemOverview } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";

export function SystemCard({ overview }: { overview: SystemOverview | null }) {
	const cores = overview?.processorCount ?? 1;
	const load = overview?.loadAverage;

	const loads = load
		? [
				{ label: "1 MIN", value: load.oneMinute },
				{ label: "5 MIN", value: load.fiveMinutes },
				{ label: "15 MIN", value: load.fifteenMinutes },
			]
		: [];

	return (
		<Card className="p-5 sm:p-6">
			<CardHeader
				icon={<Server className="size-5" />}
				channel="CH-G / Host"
				title={overview?.hostname ?? "Server"}
				subtitle={overview ? overview.operatingSystem.toUpperCase() : "LOADING…"}
			/>

			<dl className="mt-5 grid grid-cols-3 border-2 border-ink">
				<InfoTile label="Uptime" value={formatDuration(overview?.uptimeSeconds)} />
				<InfoTile label="Cores" value={overview ? String(cores) : "—"} className="border-x-2 border-ink" />
				<InfoTile label="Arch" value={overview?.architecture ?? "—"} />
			</dl>

			<div className="mt-5">
				<p className="label">Load average / per core</p>
				<div className="mt-3 space-y-2.5">
					{loads.map((item, index) => {
						const ratio = Math.min(item.value / cores, 1);
						const fill = ratio > 0.9 ? "bg-alert" : ratio > 0.7 ? "bg-accent" : "bg-ink";

						return (
							<div key={item.label} className="flex items-center gap-3 font-mono text-xs">
								<span className="w-14 font-bold">{item.label}</span>
								<div className="h-4 flex-1 border-2 border-ink bg-surface p-[2px]">
									<motion.div
										className={cn("h-full", fill)}
										initial={{ width: 0 }}
										animate={{ width: `${Math.max(ratio * 100, 2)}%` }}
										transition={{ type: "spring", stiffness: 160, damping: 22, delay: index * 0.08 }}
									/>
								</div>
								<span className="w-10 text-right font-bold tabular">{item.value.toFixed(2)}</span>
							</div>
						);
					})}
					{!loads.length ? <div className="skeleton h-14" /> : null}
				</div>
			</div>
		</Card>
	);
}

function InfoTile({ label, value, className }: { label: string; value: string; className?: string }) {
	return (
		<div className={cn("px-3 py-2", className)}>
			<dt className="label text-muted">{label}</dt>
			<dd className="mt-0.5 truncate text-sm font-bold">{value}</dd>
		</div>
	);
}
