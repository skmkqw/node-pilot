"use client";

import { AnimatePresence, motion } from "motion/react";
import { RefreshCw, ShieldCheck, ShieldOff, ShieldQuestion, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toaster";
import { adBlockApi } from "@/lib/api/endpoints";
import type { AdBlockerStatus } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatCompact } from "@/lib/format";
import { usePolling } from "@/lib/use-polling";

const PAUSE_OPTIONS = [
	{ label: "5 min", seconds: 5 * 60 },
	{ label: "30 min", seconds: 30 * 60 },
	{ label: "1 h", seconds: 60 * 60 },
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
					? `Turns back on automatically in ${Math.round(durationSeconds / 60)} min.`
					: enabled
						? "Ads and trackers are filtered for every device."
						: "Ads are not filtered until you turn it back on.",
			});
		} catch (error) {
			toast({ tone: "error", title: "Could not change ad blocking", description: (error as Error).message });
		} finally {
			setPending(false);
		}
	};

	const data = status.data;
	const enabled = data?.blockingEnabled === true;

	return (
		<Card className="p-5 sm:p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-center gap-3">
					<ShieldBadge status={data} />
					<div>
						<p className="label text-muted">CH-F / DNS filter</p>
						<h3 className="text-lg font-bold uppercase leading-tight">Ad blocker</h3>
						<p className="font-mono text-xs text-muted">{describe(data)}</p>
					</div>
				</div>
				{data?.reachable ? (
					<Switch size="lg" label="Network-wide ad blocking" checked={enabled} disabled={pending} onChange={(checked) => void setBlocking(checked)} />
				) : null}
			</div>

			{/* The skeleton sits outside AnimatePresence so real content never waits for its exit. */}
			{!data ? (
				<div className="mt-5 grid grid-cols-2 gap-3">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="skeleton h-14" />
					))}
				</div>
			) : null}

			<AnimatePresence mode="popLayout" initial={false}>
				{!data ? null : !data.configured ? (
					<NotConfigured key="not-configured" />
				) : !data.reachable ? (
					<motion.div key="unreachable" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 border-2 border-ink bg-accent p-4">
						<p className="flex items-center gap-2 text-sm font-bold uppercase">
							<span className="led animate-blink bg-alert" /> Pi-hole not responding
						</p>
						<p className="mt-1 font-mono text-xs">{data.message}</p>
						<Button size="sm" className="mt-3" onClick={status.refresh}>
							<RefreshCw className="size-3.5" /> Retry
						</Button>
					</motion.div>
				) : (
					<motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
						<BlockedMeter percent={data.percentBlocked ?? 0} active={enabled} />

						<div className="mt-4 grid grid-cols-2 border-2 border-ink">
							<Stat label="Queries" value={data.totalQueries} className="border-b-2 border-r-2 border-ink" />
							<Stat label="Blocked" value={data.blockedQueries} className="border-b-2 border-ink" />
							<Stat label="Clients" value={data.activeClients} className="border-r-2 border-ink" />
							<Stat label="Blocklist" value={data.domainsOnBlocklist} />
						</div>

						<div className="mt-4">
							{!enabled && data.blockingTimerSeconds ? (
								<Countdown status={data} onElapsed={status.refresh} />
							) : enabled ? (
								<div className="flex flex-wrap items-center gap-2">
									<span className="label mr-1 text-muted">Pause</span>
									{PAUSE_OPTIONS.map((option) => (
										<Button key={option.seconds} size="sm" disabled={pending} onClick={() => void setBlocking(false, option.seconds)}>
											{option.label}
										</Button>
									))}
								</div>
							) : (
								<p className="flex items-center gap-2 font-mono text-xs font-bold uppercase">
									<span className="led bg-accent" /> Filter off — devices see ads
								</p>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</Card>
	);
}

function describe(status: AdBlockerStatus | null) {
	if (!status) return "CHECKING PI-HOLE…";
	if (!status.configured) return "NOT CONNECTED";
	if (!status.reachable) return "CONNECTION FAULT";
	if (status.blockingEnabled) return `PROTECTING ${status.activeClients ?? 0} DEVICES`;
	return "BLOCKING PAUSED";
}

function ShieldBadge({ status }: { status: AdBlockerStatus | null }) {
	const state = !status?.reachable ? "unknown" : status.blockingEnabled ? "on" : "off";
	const styles = {
		on: { icon: ShieldCheck, plate: "bg-ok" },
		off: { icon: ShieldOff, plate: "bg-accent" },
		unknown: { icon: ShieldQuestion, plate: "bg-ground" },
	}[state];

	return (
		<div className={cn("relative grid size-12 place-items-center overflow-hidden border-2 border-ink transition-colors duration-300", styles.plate)}>
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span
					key={state}
					initial={{ y: -14, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: 14, opacity: 0 }}
					transition={{ type: "spring", stiffness: 700, damping: 30 }}
				>
					<styles.icon className="size-5" />
				</motion.span>
			</AnimatePresence>
		</div>
	);
}

/** Share of blocked queries as a 20-segment strip. */
function BlockedMeter({ percent, active }: { percent: number; active: boolean }) {
	const segments = 20;
	const lit = Math.round((Math.min(percent, 100) / 100) * segments);

	return (
		<div className="mt-5">
			<div className="flex items-end justify-between">
				<span className="label">Blocked today</span>
				<span className="text-3xl font-bold leading-none tabular">
					<AnimatedNumber value={percent} decimals={1} />
					<span className="text-base">%</span>
				</span>
			</div>
			<div className="mt-2 grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[2px]">
				{Array.from({ length: segments }).map((_, index) => (
					<span key={index} className="relative h-3 border-[1.5px] border-ink">
						<motion.span
							className={cn("absolute inset-0", active ? "bg-ink" : "bg-muted")}
							initial={false}
							animate={{ opacity: index < lit ? 1 : 0 }}
							transition={{ duration: 0.06, delay: index * 0.025 }}
						/>
					</span>
				))}
			</div>
		</div>
	);
}

function Stat({ label, value, className }: { label: string; value: number | null; className?: string }) {
	return (
		<div className={cn("bg-surface px-3 py-2", className)}>
			<p className="label text-muted">{label}</p>
			<p className="text-xl font-bold tabular">
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

	const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
	const seconds = String(remaining % 60).padStart(2, "0");

	return (
		<div className="flex items-center justify-between gap-3 border-2 border-ink bg-accent px-3 py-2">
			<span className="label flex items-center gap-2">
				<Timer className="size-4" /> Paused · resumes in
			</span>
			<span className="bg-ink px-2 py-0.5 font-mono text-lg font-bold text-accent tabular">
				{minutes}:{seconds}
			</span>
		</div>
	);
}

function NotConfigured() {
	const { isAdmin } = useAuth();

	return (
		<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 border-2 border-dashed border-ink bg-ground/60 p-4">
			<p className="flex items-center gap-2 text-sm font-bold uppercase">
				<span className="led bg-ground" /> Pi-hole not connected
			</p>
			<p className="mt-1.5 font-mono text-xs leading-5 text-muted">
				{isAdmin
					? "Add your Pi-hole address and app password to control network-wide ad blocking from here."
					: "An administrator can connect Pi-hole in Settings."}
			</p>
			{isAdmin ? (
				<Link href="/settings#pihole" className={buttonStyles("primary", "sm", "mt-3")}>
					Connect Pi-hole
				</Link>
			) : null}
		</motion.div>
	);
}
