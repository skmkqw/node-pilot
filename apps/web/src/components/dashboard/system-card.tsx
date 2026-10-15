"use client";

import { motion } from "motion/react";
import { Clock, Cpu, Server } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import type { SystemOverview } from "@/lib/api/types";
import { formatDuration } from "@/lib/format";

export function SystemCard({ overview }: { overview: SystemOverview | null }) {
	const cores = overview?.processorCount ?? 1;
	const load = overview?.loadAverage;

	const loads = load
		? [
				{ label: "1 min", value: load.oneMinute },
				{ label: "5 min", value: load.fiveMinutes },
				{ label: "15 min", value: load.fifteenMinutes },
			]
		: [];

	return (
		<Card glow="#818cf8" className="p-5 sm:p-6">
			<CardHeader
				icon={<Server className="size-5" />}
				accent="#818cf8"
				title={overview?.hostname ?? "Server"}
				subtitle={overview ? overview.operatingSystem : "Loading…"}
			/>

			<div className="mt-5 grid grid-cols-3 gap-2">
				<InfoTile icon={<Clock className="size-3.5" />} label="Uptime" value={formatDuration(overview?.uptimeSeconds)} />
				<InfoTile icon={<Cpu className="size-3.5" />} label="Cores" value={overview ? String(cores) : "—"} />
				<InfoTile label="Arch" value={overview?.architecture ?? "—"} />
			</div>

			<div className="mt-5">
				<p className="text-[0.68rem] uppercase tracking-[0.16em] text-slate-500">Load average</p>
				<div className="mt-3 space-y-2.5">
					{loads.map((item, index) => {
						const ratio = Math.min(item.value / cores, 1);
						const color = ratio > 0.9 ? "#fb7185" : ratio > 0.7 ? "#fbbf24" : "#818cf8";

						return (
							<div key={item.label} className="flex items-center gap-3 text-xs">
								<span className="w-12 text-slate-400">{item.label}</span>
								<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
									<motion.div
										className="h-full rounded-full"
										style={{ background: `linear-gradient(90deg, ${color}66, ${color})`, boxShadow: `0 0 12px ${color}` }}
										initial={{ width: 0 }}
										animate={{ width: `${Math.max(ratio * 100, 2)}%` }}
										transition={{ type: "spring", stiffness: 60, damping: 18, delay: index * 0.08 }}
									/>
								</div>
								<span className="w-10 text-right font-mono text-slate-200 tabular">{item.value.toFixed(2)}</span>
							</div>
						);
					})}
					{!loads.length ? <div className="skeleton h-14 rounded-xl" /> : null}
				</div>
			</div>
		</Card>
	);
}

function InfoTile({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
			<p className="flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">
				{icon}
				{label}
			</p>
			<p className="mt-1 truncate text-sm font-medium text-white">{value}</p>
		</div>
	);
}
