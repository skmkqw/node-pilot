"use client";

import { AnimatePresence, motion } from "motion/react";
import { ShieldMinus, ShieldPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toaster";
import { usersApi } from "@/lib/api/endpoints";
import type { UserSummary } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { RoleBadge } from "./invite-panel";

type UserListProps = {
	users: UserSummary[] | null;
	currentUsername: string;
	onChanged: () => void;
};

export function UserList({ users, currentUsername, onChanged }: UserListProps) {
	const toast = useToast();
	const [pendingId, setPendingId] = useState<number | null>(null);
	const [toRemove, setToRemove] = useState<UserSummary | null>(null);

	const toggleRole = async (user: UserSummary) => {
		const role = user.role === "Admin" ? "Member" : "Admin";
		setPendingId(user.id);

		try {
			await usersApi.setRole(user.id, role);
			toast({ tone: "success", title: `${user.username} is now ${role === "Admin" ? "an admin" : "a member"}` });
			onChanged();
		} catch (error) {
			toast({ tone: "error", title: "Could not change the role", description: (error as Error).message });
		} finally {
			setPendingId(null);
		}
	};

	const remove = async () => {
		if (!toRemove) return;
		setPendingId(toRemove.id);

		try {
			await usersApi.remove(toRemove.id);
			toast({ tone: "success", title: `${toRemove.username} removed`, description: "They were signed out on all devices." });
			setToRemove(null);
			onChanged();
		} catch (error) {
			toast({ tone: "error", title: "Could not remove the user", description: (error as Error).message });
		} finally {
			setPendingId(null);
		}
	};

	if (users === null) {
		return (
			<div className="space-y-2">
				<div className="skeleton h-16" />
				<div className="skeleton h-16" />
			</div>
		);
	}

	return (
		<>
			<ul className="divide-y-2 divide-ink border-2 border-ink">
				<AnimatePresence initial={false}>
					{users.map((user) => {
						const isSelf = user.username.toLowerCase() === currentUsername.toLowerCase();

						return (
							<motion.li
								key={user.id}
								layout
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: "auto" }}
								exit={{ opacity: 0, height: 0 }}
								className="flex flex-wrap items-center gap-3 bg-surface px-3 py-3"
							>
								<div className="grid size-10 shrink-0 place-items-center border-2 border-ink bg-ground font-mono text-base font-bold">
									{user.username.slice(0, 1).toUpperCase()}
								</div>
								<div className="min-w-0 flex-1">
									<p className="flex items-center gap-2 truncate text-sm font-bold">
										{user.username}
										{isSelf ? <span className="label text-muted">· You</span> : null}
									</p>
									<p className="font-mono text-xs text-muted">Joined {formatDateTime(user.createdAtUtc)}</p>
								</div>
								<RoleBadge role={user.role} />
								{!isSelf ? (
									<div className="flex gap-2">
										<Button
											size="sm"
											variant="secondary"
											isLoading={pendingId === user.id && toRemove === null}
											onClick={() => void toggleRole(user)}
										>
											{user.role === "Admin" ? <ShieldMinus className="size-4" /> : <ShieldPlus className="size-4" />}
											{user.role === "Admin" ? "Make member" : "Make admin"}
										</Button>
										<Button size="icon" variant="ghost" onClick={() => setToRemove(user)} aria-label={`Remove ${user.username}`} title="Remove user">
											<Trash2 className="size-4" />
										</Button>
									</div>
								) : null}
							</motion.li>
						);
					})}
				</AnimatePresence>
			</ul>

			<ConfirmDialog
				open={toRemove !== null}
				title={`Remove ${toRemove?.username}?`}
				description="They lose access immediately and are signed out on every device. Invite links they created stop working. Their files stay on the server."
				confirmLabel="Remove user"
				isPending={toRemove !== null && pendingId === toRemove.id}
				onConfirm={() => void remove()}
				onCancel={() => setToRemove(null)}
			/>
		</>
	);
}
