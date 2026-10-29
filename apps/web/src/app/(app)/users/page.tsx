"use client";

import { motion } from "motion/react";
import { Link2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { InvitePanel } from "@/components/users/invite-panel";
import { UserList } from "@/components/users/user-list";
import { invitationsApi, usersApi } from "@/lib/api/endpoints";
import { usePolling } from "@/lib/use-polling";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = {
	hidden: { opacity: 0, y: 18 },
	show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 240, damping: 26 } },
};

export default function UsersPage() {
	const { user, isAdmin } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!isAdmin) router.replace("/");
	}, [isAdmin, router]);

	if (!isAdmin || !user) return null;

	return <UsersContent username={user.username} />;
}

function UsersContent({ username }: { username: string }) {
	// Refreshed after every change and once a minute, so expired links drop off the list.
	const users = usePolling((signal) => usersApi.list(signal), 60_000);
	const invitations = usePolling((signal) => invitationsApi.list(signal), 60_000);

	const refresh = () => {
		users.refresh();
		invitations.refresh();
	};

	const userCount = users.data?.length;

	return (
		<>
			<PageHeader title="Users" description="Invite people in your household and decide what they can change." />

			<motion.div variants={container} initial="hidden" animate="show" className="grid items-start gap-5 sm:gap-6 xl:grid-cols-2">
				<Card className="p-5 sm:p-6" variants={item}>
					<CardHeader
						icon={<Link2 className="size-5" />}
						channel="USR-01"
						title="Invite someone"
						subtitle="ONE-TIME LINK · THEY CHOOSE THEIR OWN PASSWORD"
					/>
					<div className="mt-6">
						<InvitePanel pending={invitations.data} onChanged={refresh} />
					</div>
				</Card>

				<Card className="p-5 sm:p-6" variants={item}>
					<CardHeader
						icon={<Users className="size-5" />}
						channel="USR-02"
						title="Accounts"
						subtitle={userCount === undefined ? "LOADING…" : `${userCount} ${userCount === 1 ? "ACCOUNT" : "ACCOUNTS"}`}
					/>
					<div className="mt-6">
						<UserList users={users.data} currentUsername={username} onChanged={refresh} />
					</div>
				</Card>
			</motion.div>
		</>
	);
}
