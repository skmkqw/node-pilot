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

			<motion.div variants={container} initial="hidden" animate="show" className="grid items-start gap-5 sm:gap-6 xl:grid-cols-2">
				<Card className="p-5 sm:p-6" variants={item}>
					<CardHeader
						icon={<UserCog className="size-5" />}
						channel="CFG-01"
						title="Account"
						subtitle={<>SIGNED IN AS <span className="font-bold text-ink">{user?.username}</span></>}
					/>
					<div className="mt-6">
						<ChangePasswordForm />
					</div>
				</Card>

				<Card id="pihole" className="scroll-mt-24 p-5 sm:p-6" variants={item}>
					<CardHeader
						icon={<ShieldCheck className="size-5" />}
						channel="CFG-02"
						title="Ad blocker (Pi-hole)"
						subtitle={
							piHole.data?.source === "None"
								? "NOT CONNECTED"
								: piHole.data?.baseUrl
									? `CONNECTED · ${piHole.data.baseUrl}`
									: "LOADING…"
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
								<div className="skeleton h-16" />
								<div className="skeleton h-16" />
							</div>
						)}
					</div>
				</Card>
			</motion.div>
		</>
	);
}
