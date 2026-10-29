"use client";

import { motion } from "motion/react";
import { Cpu, HardDrive, MemoryStick, Thermometer } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AdBlockCard } from "@/components/dashboard/adblock-card";
import { MetricMeter } from "@/components/dashboard/metric-meter";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { SystemCard } from "@/components/dashboard/system-card";
import { PageHeader } from "@/components/shell/page-header";
import { systemApi } from "@/lib/api/endpoints";
import { formatBytes, formatDuration, temperatureSeverity, usageSeverity } from "@/lib/format";
import { usePolling } from "@/lib/use-polling";

const container = {
	hidden: {},
	show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const item = {
	hidden: { opacity: 0, y: 16 },
	show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 420, damping: 34 } },
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

	const severities = [
		usageSeverity(metric?.cpuUsagePercent),
		usageSeverity(metric?.ramUsagePercent),
		temperatureSeverity(temperature),
		usageSeverity(disk?.usagePercent),
	];
	const warnings = severities.filter((severity) => severity === "critical").length;

	return (
		<>
			<PageHeader
				eyebrow={
					<>
						<span className="flex items-center gap-1.5 border-2 border-ink bg-surface px-2 py-1 text-ink">
							<span className="led size-2.5 animate-blink border-[1.5px] bg-ok" /> Live
						</span>
						{info ? (
							<span>
								{info.hostname} · up {formatDuration(info.uptimeSeconds)}
							</span>
						) : null}
					</>
				}
				title={
					<>
						{greeting()}, {user?.username ?? "there"}.{" "}
						{warnings > 0 ? (
							<span className="whitespace-nowrap bg-ink px-2 text-accent">
								{warnings} warning{warnings > 1 ? "s" : ""}.
							</span>
						) : null}
					</>
				}
			/>

			{offline ? (
				<motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3 border-2 border-ink bg-accent p-4 font-mono text-sm font-bold">
					<span className="led animate-blink bg-alert" />
					{current.error?.message ?? "Live metrics are unavailable."}
				</motion.div>
			) : null}

			<motion.div variants={container} initial="hidden" animate="show" className="grid gap-5 sm:gap-6">
				<div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 sm:gap-6 xl:grid-cols-4">
					<MetricMeter
						channel="CH-A"
						label="CPU"
						icon={<Cpu className="size-4" />}
						value={metric?.cpuUsagePercent ?? null}
						percent={metric?.cpuUsagePercent ?? null}
						unit="%"
						severity={severities[0]}
						detail={info ? `${info.processorCount} CORES · LOAD ${info.loadAverage?.oneMinute.toFixed(2) ?? "—"}` : "PROCESSOR LOAD"}
					/>
					<MetricMeter
						channel="CH-B"
						label="Memory"
						icon={<MemoryStick className="size-4" />}
						value={metric?.ramUsagePercent ?? memory?.ramUsagePercent ?? null}
						percent={metric?.ramUsagePercent ?? memory?.ramUsagePercent ?? null}
						unit="%"
						severity={severities[1]}
						detail={memory ? `${formatBytes(memory.usedMemoryBytes)} / ${formatBytes(memory.totalMemoryBytes)}` : "RAM IN USE"}
					/>
					<MetricMeter
						channel="CH-C"
						label="Thermal"
						icon={<Thermometer className="size-4" />}
						value={temperature}
						percent={temperature === null ? null : Math.min(temperature, 100)}
						unit="°C"
						severity={severities[2]}
						severityLabels={{ ok: "Optimal", warn: "Warm", critical: "Hot" }}
						detail="CPU PACKAGE"
						unavailableText="No sensor"
					/>
					<MetricMeter
						channel="CH-D"
						label="Disk"
						icon={<HardDrive className="size-4" />}
						value={disk?.usagePercent ?? null}
						percent={disk?.usagePercent ?? null}
						unit="%"
						severity={severities[3]}
						detail={disk ? `${formatBytes(disk.availableBytes)} FREE / ${formatBytes(disk.totalBytes)}` : "ROOT FILESYSTEM"}
					/>
				</div>

				<div className="grid gap-5 sm:gap-6 xl:grid-cols-3">
					<motion.div variants={item} className="xl:col-span-2">
						<PerformanceChart />
					</motion.div>
					<div className="grid content-start gap-5 sm:gap-6">
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
