"use client";

import { motion } from "motion/react";
import { Cpu, HardDrive, MemoryStick, Thermometer, TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AdBlockCard } from "@/components/dashboard/adblock-card";
import { MetricGauge } from "@/components/dashboard/metric-gauge";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { SystemCard } from "@/components/dashboard/system-card";
import { PageHeader } from "@/components/shell/page-header";
import { systemApi } from "@/lib/api/endpoints";
import { formatBytes, formatDuration, temperatureSeverity, usageSeverity } from "@/lib/format";
import { usePolling } from "@/lib/use-polling";

const container = {
	hidden: {},
	show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const item = {
	hidden: { opacity: 0, y: 18, scale: 0.98 },
	show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 240, damping: 26 } },
};

function greeting() {
	const hour = new Date().getHours();
	if (hour < 5) return "Good night";
	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}

export default function DashboardPage() {
	const { user } = useAuth();
	const current = usePolling((signal) => systemApi.current(signal), 5_000);
	const overview = usePolling((signal) => systemApi.overview(signal), 10_000);

	const metric = current.data;
	const info = overview.data;
	const temperature = info?.cpuTemperatureCelsius ?? null;
	const memory = info?.memory;
	const disk = info?.disk;
	const offline = current.error && !metric;

	return (
		<>
			<PageHeader
				eyebrow={
					<>
						<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 font-medium text-emerald-200">
							<span className="relative flex size-1.5">
								<span className="absolute inline-flex size-full rounded-full bg-emerald-400 animate-ping-slow" />
								<span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
							</span>
							Live
						</span>
						{info ? (
							<span>
								{info.hostname} · up {formatDuration(info.uptimeSeconds)}
							</span>
						) : null}
					</>
				}
				title={`${greeting()}, ${user?.username ?? "there"}`}
				description="Everything your server is doing, at a glance."
			/>

			{offline ? (
				<motion.div
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100"
				>
					<TriangleAlert className="size-5 shrink-0 text-rose-300" />
					{current.error?.message ?? "Live metrics are unavailable."}
				</motion.div>
			) : null}

			<motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:gap-5">
				<div className="grid grid-cols-2 gap-4 sm:gap-5 xl:grid-cols-4">
					<MetricGauge
						label="CPU"
						icon={<Cpu className="size-4" />}
						value={metric?.cpuUsagePercent ?? null}
						percent={metric?.cpuUsagePercent ?? null}
						unit="%"
						color="#22d3ee"
						colorTo="#60a5fa"
						severity={usageSeverity(metric?.cpuUsagePercent)}
						detail={info ? `${info.processorCount} cores · load ${info.loadAverage?.oneMinute.toFixed(2) ?? "—"}` : "Processor load"}
					/>
					<MetricGauge
						label="Memory"
						icon={<MemoryStick className="size-4" />}
						value={metric?.ramUsagePercent ?? memory?.ramUsagePercent ?? null}
						percent={metric?.ramUsagePercent ?? memory?.ramUsagePercent ?? null}
						unit="%"
						color="#a78bfa"
						colorTo="#e879f9"
						severity={usageSeverity(metric?.ramUsagePercent)}
						detail={memory ? `${formatBytes(memory.usedMemoryBytes)} of ${formatBytes(memory.totalMemoryBytes)}` : "RAM in use"}
					/>
					<MetricGauge
						label="Temperature"
						icon={<Thermometer className="size-4" />}
						value={temperature}
						percent={temperature === null ? null : Math.min((temperature / 100) * 100, 100)}
						unit="°C"
						color="#fbbf24"
						colorTo="#f43f5e"
						severity={temperatureSeverity(temperature)}
						severityLabels={{ ok: "Optimal", warn: "Warm", critical: "Hot" }}
						detail="CPU package sensor"
						unavailableText="No sensor"
					/>
					<MetricGauge
						label="Disk"
						icon={<HardDrive className="size-4" />}
						value={disk?.usagePercent ?? null}
						percent={disk?.usagePercent ?? null}
						unit="%"
						color="#34d399"
						colorTo="#2dd4bf"
						severity={usageSeverity(disk?.usagePercent)}
						detail={disk ? `${formatBytes(disk.availableBytes)} free of ${formatBytes(disk.totalBytes)}` : "Root filesystem"}
					/>
				</div>

				<div className="grid gap-4 sm:gap-5 xl:grid-cols-3">
					<motion.div variants={item} className="xl:col-span-2">
						<PerformanceChart />
					</motion.div>
					<div className="grid content-start gap-4 sm:gap-5">
						<motion.div variants={item}>
							<AdBlockCard />
						</motion.div>
						<motion.div variants={item}>
							<SystemCard overview={info} />
						</motion.div>
					</div>
				</div>
			</motion.div>
		</>
	);
}
