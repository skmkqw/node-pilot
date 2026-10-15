"use client";

import { AnimatePresence, motion } from "motion/react";
import { Ban, RefreshCw, ShieldCheck, ShieldOff, ShieldQuestion, Timer, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toaster";
import { adBlockApi } from "@/lib/api/endpoints";
import type { AdBlockerStatus } from "@/lib/api/types";
import { formatCompact } from "@/lib/format";
import { usePolling } from "@/lib/use-polling";

const PAUSE_OPTIONS = [
	{ label: "5 min", seconds: 5 * 60 },
	{ label: "30 min", seconds: 30 * 60 },
	{ label: "1 hour", seconds: 60 * 60 },
];

export function AdBlockCard() {
	const toast = useToast();
	const status = usePolling((signal) => adBlockApi.status(signal), 15_000);
	const [pending, setPending] = useState(false);

	const setBlocking = async (enabled: boolean, durationSeconds?: number) => {
		setPending(true);

		try {
			const next = await adBlockApi.setBlocking(enabled, durationSeconds);
			status.setData(next);
			toast({
				tone: "success",
				title: enabled ? "Ad blocking enabled" : "Ad blocking paused",
				description: durationSeconds
					? `Automatically turns back on in ${Math.round(durationSeconds / 60)} minutes.`
					: enabled
						? "Ads and trackers are being filtered for every device."
						: "Ads will not be filtered until you turn it back on.",
			});
		} catch (error) {
			toast({ tone: "error", title: "Could not change ad blocking", description: (error as Error).message });
		} finally {
			setPending(false);
		}
	};

	const data = status.data;
	const enabled = data?.blockingEnabled === true;
	const accent = enabled ? "#34d399" : "#38bdf8";

	return (
		<Card glow={accent} className="p-5 sm:p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-center gap-3">
					<ShieldBadge status={data} />
					<div>
						<h3 className="text-sm font-semibold text-white">Ad blocker</h3>
						<p className="text-xs text-muted">{describe(data)}</p>
					</div>
				</div>
				{data?.reachable ? (
					<Switch
						size="lg"
						label="Network-wide ad blocking"
						checked={enabled}
						disabled={pending}
						onChange={(checked) => void setBlocking(checked)}
					/>
				) : null}
			</div>

			{/* The skeleton sits outside AnimatePresence so real content never waits for its exit. */}
			{!data ? (
				<div className="mt-5 grid grid-cols-2 gap-3">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="skeleton h-16 rounded-2xl" />
					))}
				</div>
			) : null}

			<AnimatePresence mode="popLayout" initial={false}>
				{!data ? null : !data.configured ? (
					<NotConfigured key="not-configured" />
				) : !data.reachable ? (
					<motion.div
						key="unreachable"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/[0.07] p-4"
					>
						<p className="text-sm font-medium text-amber-100">Pi-hole is not responding</p>
						<p className="mt-1 text-xs text-amber-100/70">{data.message}</p>
						<Button size="sm" className="mt-3" onClick={status.refresh}>
							<RefreshCw className="size-3.5" /> Retry
						</Button>
					</motion.div>
				) : (
					<motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
						<div className="mt-5 flex items-center gap-5">
							<BlockedRing percent={data.percentBlocked ?? 0} active={enabled} />
							<div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
								<Stat label="Queries today" value={data.totalQueries} />
								<Stat label="Blocked" value={data.blockedQueries} />
								<Stat label="Clients" value={data.activeClients} icon={<Users className="size-3" />} />
								<Stat label="Blocklist" value={data.domainsOnBlocklist} />
							</div>
						</div>

						<div className="mt-5 border-t border-white/5 pt-4">
							{!enabled && data.blockingTimerSeconds ? (
								<Countdown status={data} onElapsed={status.refresh} />
							) : enabled ? (
								<div className="flex flex-wrap items-center gap-2">
									<span className="mr-1 text-xs text-muted">Pause for</span>
									{PAUSE_OPTIONS.map((option) => (
										<Button
											key={option.seconds}
											size="sm"
											variant="secondary"
											disabled={pending}
											onClick={() => void setBlocking(false, option.seconds)}
										>
											{option.label}
										</Button>
									))}
								</div>
							) : (
								<p className="text-xs text-amber-200/80">Blocking is off. Devices in your network currently see ads.</p>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</Card>
	);
}

function describe(status: AdBlockerStatus | null) {
	if (!status) return "Checking Pi-hole…";
	if (!status.configured) return "Pi-hole not connected";
	if (!status.reachable) return "Connection problem";
	if (status.blockingEnabled) return `Protecting ${status.activeClients ?? 0} devices`;
	return "Blocking paused";
}

function ShieldBadge({ status }: { status: AdBlockerStatus | null }) {
	const state = !status?.reachable ? "unknown" : status.blockingEnabled ? "on" : "off";
	const styles = {
		on: { icon: ShieldCheck, color: "#34d399" },
		off: { icon: ShieldOff, color: "#fbbf24" },
		unknown: { icon: ShieldQuestion, color: "#94a3b8" },
	}[state];

	return (
		<div
			className="relative grid size-11 place-items-center rounded-2xl border border-white/10"
			style={{ color: styles.color, background: `color-mix(in oklab, ${styles.color} 14%, transparent)`, boxShadow: `0 0 28px -8px ${styles.color}` }}
		>
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span
					key={state}
					initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
					animate={{ scale: 1, rotate: 0, opacity: 1 }}
					exit={{ scale: 0.4, rotate: 30, opacity: 0 }}
					transition={{ type: "spring", stiffness: 500, damping: 25 }}
				>
					<styles.icon className="size-5" />
				</motion.span>
			</AnimatePresence>
			{state === "on" ? (
				<span className="absolute inset-0 rounded-2xl border border-emerald-300/40 animate-ping-slow" />
			) : null}
		</div>
	);
}

function BlockedRing({ percent, active }: { percent: number; active: boolean }) {
	const radius = 38;
	const circumference = 2 * Math.PI * radius;
	const color = active ? "#34d399" : "#64748b";

	return (
		<div className="relative size-28 shrink-0">
			<svg viewBox="0 0 100 100" className="size-full -rotate-90">
				<circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="9" />
				<motion.circle
					cx="50"
					cy="50"
					r={radius}
					fill="none"
					stroke={color}
					strokeWidth="9"
					strokeLinecap="round"
					strokeDasharray={circumference}
					initial={{ strokeDashoffset: circumference }}
					animate={{ strokeDashoffset: circumference * (1 - Math.min(percent, 100) / 100) }}
					transition={{ type: "spring", stiffness: 50, damping: 16 }}
					style={{ filter: `drop-shadow(0 0 6px ${color})` }}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="text-xl font-semibold text-white">
					<AnimatedNumber value={percent} decimals={1} />
					<span className="text-xs text-slate-400">%</span>
				</span>
				<span className="text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">blocked</span>
			</div>
		</div>
	);
}

function Stat({ label, value, icon }: { label: string; value: number | null; icon?: React.ReactNode }) {
	return (
		<div>
			<p className="flex items-center gap-1 text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">
				{icon}
				{label}
			</p>
			<p className="mt-0.5 text-lg font-semibold text-white">
				<AnimatedNumber value={value} format={(current) => formatCompact(Math.round(current))} />
			</p>
		</div>
	);
}

function Countdown({ status, onElapsed }: { status: AdBlockerStatus; onElapsed: () => void }) {
	const resumeAt = new Date(status.checkedAtUtc).getTime() + (status.blockingTimerSeconds ?? 0) * 1000;
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	const remaining = Math.max(0, Math.round((resumeAt - now) / 1000));

	useEffect(() => {
		if (remaining === 0) onElapsed();
	}, [remaining, onElapsed]);

	const minutes = Math.floor(remaining / 60);
	const seconds = String(remaining % 60).padStart(2, "0");

	return (
		<div className="flex items-center gap-2 text-xs text-amber-100/90">
			<Timer className="size-4 text-amber-300" />
			Paused — turns back on in <span className="font-mono text-sm text-white tabular">{minutes}:{seconds}</span>
		</div>
	);
}

function NotConfigured() {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0 }}
			className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4"
		>
			<div className="flex items-center gap-2 text-sm font-medium text-slate-200">
				<Ban className="size-4 text-slate-400" /> Connect your Pi-hole
			</div>
			<p className="mt-1.5 text-xs leading-5 text-muted">
				Add the address and app password of your Pi-hole (v6) to the server&apos;s <code className="text-slate-300">.env</code>{" "}
				file and restart NodePilot:
			</p>
			<pre className="mt-3 overflow-x-auto rounded-xl border border-white/5 bg-black/40 p-3 font-mono text-[0.72rem] leading-5 text-cyan-200/90">
				{"PiHole__BaseUrl=http://192.168.1.2\nPiHole__Password=your-app-password"}
			</pre>
		</motion.div>
	);
}
