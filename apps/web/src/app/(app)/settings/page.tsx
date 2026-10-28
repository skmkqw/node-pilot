"use client";

import { motion } from "motion/react";
import { ShieldCheck, UserCog } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { PiHoleForm } from "@/components/settings/pihole-form";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { settingsApi } from "@/lib/api/endpoints";
import { usePolling } from "@/lib/use-polling";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = {
	hidden: { opacity: 0, y: 18 },
	show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 240, damping: 26 } },
};

export default function SettingsPage() {
	const { user } = useAuth();
	// Loaded once; the form keeps its own state while editing.
	const piHole = usePolling((signal) => settingsApi.piHole(signal), 10 * 60_000);

	return (
		<>
			<PageHeader title="Settings" description="Your account and the services NodePilot connects to." />

			<motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:gap-5 xl:grid-cols-2">
				<Card glow="#22d3ee" className="p-5 sm:p-6" variants={item}>
					<CardHeader
						icon={<UserCog className="size-5" />}
						accent="#22d3ee"
						title="Account"
						subtitle={<>Signed in as <span className="text-slate-200">{user?.username}</span></>}
					/>
					<div className="mt-6">
						<ChangePasswordForm />
					</div>
				</Card>

				<Card id="pihole" glow="#34d399" className="p-5 sm:p-6" variants={item}>
					<CardHeader
						icon={<ShieldCheck className="size-5" />}
						accent="#34d399"
						title="Ad blocker (Pi-hole)"
						subtitle={
							piHole.data?.source === "None"
								? "Not connected"
								: piHole.data?.baseUrl
									? `Connected to ${piHole.data.baseUrl}`
									: "Loading…"
						}
					/>
					<div className="mt-6">
						{piHole.data ? (
							<PiHoleForm
								key={`${piHole.data.source}-${piHole.data.baseUrl}`}
								info={piHole.data}
								onSaved={(info) => piHole.setData(info)}
								onDisconnected={piHole.refresh}
							/>
						) : (
							<div className="space-y-4">
								<div className="skeleton h-16 rounded-2xl" />
								<div className="skeleton h-16 rounded-2xl" />
							</div>
						)}
					</div>
				</Card>
			</motion.div>
		</>
	);
}
