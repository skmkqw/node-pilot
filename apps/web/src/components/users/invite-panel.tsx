"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Link2, Send, Share2, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toaster";
import { invitationsApi } from "@/lib/api/endpoints";
import type { CreatedInvitation, InvitationSummary, UserRole } from "@/lib/api/types";
import { formatDateTime, formatRelative } from "@/lib/format";

const ROLE_OPTIONS = [
	{ value: "Member", label: "Member" },
	{ value: "Admin", label: "Admin" },
] as const;

const LIFETIME_OPTIONS = [
	{ value: "1", label: "1 h" },
	{ value: "24", label: "24 h" },
	{ value: "168", label: "7 days" },
] as const;

type Lifetime = (typeof LIFETIME_OPTIONS)[number]["value"];

type InvitePanelProps = {
	pending: InvitationSummary[] | null;
	onChanged: () => void;
};

/** Creates one-time invite links and lists the ones that were not used yet. */
export function InvitePanel({ pending, onChanged }: InvitePanelProps) {
	const toast = useToast();
	const [role, setRole] = useState<UserRole>("Member");
	const [lifetime, setLifetime] = useState<Lifetime>("24");
	const [created, setCreated] = useState<CreatedInvitation | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [revoking, setRevoking] = useState<number | null>(null);

	const create = async () => {
		setIsCreating(true);

		try {
			setCreated(await invitationsApi.create(role, Number(lifetime)));
			onChanged();
		} catch (error) {
			toast({ tone: "error", title: "Could not create the link", description: (error as Error).message });
		} finally {
			setIsCreating(false);
		}
	};

	const revoke = async (id: number) => {
		setRevoking(id);

		try {
			await invitationsApi.revoke(id);
			if (created?.id === id) setCreated(null);
			toast({ tone: "success", title: "Invite link revoked" });
			onChanged();
		} catch (error) {
			toast({ tone: "error", title: "Could not revoke the link", description: (error as Error).message });
		} finally {
			setRevoking(null);
		}
	};

	return (
		<div className="space-y-6">
			<div className="space-y-4">
				<div className="flex flex-wrap items-end gap-4">
					<div>
						<p className="label mb-1.5">Role</p>
						<Segmented label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
					</div>
					<div>
						<p className="label mb-1.5">Valid for</p>
						<Segmented label="Valid for" value={lifetime} onChange={setLifetime} options={LIFETIME_OPTIONS} />
					</div>
				</div>
				<p className="font-mono text-xs leading-5 text-muted">
					{role === "Admin"
						? "Admins can also manage users, invite links and Pi-hole settings."
						: "Members can use the dashboard, files and media, and the ad-blocking switch."}{" "}
					The link works once.
				</p>
				<Button variant="primary" onClick={() => void create()} isLoading={isCreating} className="group">
					<Link2 className="size-4" /> Create invite link
				</Button>
			</div>

			<AnimatePresence initial={false}>
				{created ? <CreatedLink key={created.id} invitation={created} onDismiss={() => setCreated(null)} /> : null}
			</AnimatePresence>

			<div>
				<p className="label mb-2 text-muted">Unused links</p>
				{pending === null ? (
					<div className="skeleton h-14" />
				) : pending.length === 0 ? (
					<p className="border-2 border-dashed border-ink px-3 py-3 font-mono text-xs text-muted">No open invite links.</p>
				) : (
					<ul className="divide-y-2 divide-ink border-2 border-ink">
						<AnimatePresence initial={false}>
							{pending.map((invitation) => (
								<motion.li
									key={invitation.id}
									layout
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: "auto" }}
									exit={{ opacity: 0, height: 0 }}
									className="flex items-center gap-3 bg-surface px-3 py-2.5"
								>
									<RoleBadge role={invitation.role} />
									<div className="min-w-0 flex-1 font-mono text-xs">
										<p className="truncate">
											Link #{invitation.id} · by <span className="font-bold">{invitation.createdBy}</span>
										</p>
										<p className="text-muted" title={formatDateTime(invitation.expiresAtUtc)}>
											Expires {formatRelative(invitation.expiresAtUtc)}
										</p>
									</div>
									<Button
										size="sm"
										variant="ghost"
										isLoading={revoking === invitation.id}
										onClick={() => void revoke(invitation.id)}
										aria-label={`Revoke link #${invitation.id}`}
									>
										<X className="size-4" /> Revoke
									</Button>
								</motion.li>
							))}
						</AnimatePresence>
					</ul>
				)}
			</div>
		</div>
	);
}

function CreatedLink({ invitation, onDismiss }: { invitation: CreatedInvitation; onDismiss: () => void }) {
	const toast = useToast();
	const inputRef = useRef<HTMLInputElement>(null);
	const [copied, setCopied] = useState(false);
	const link = invitationsApi.link(invitation.token);
	// navigator.share exists only on secure origins (https or localhost), mostly on phones.
	const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

	const copy = async () => {
		try {
			// The Clipboard API is also limited to secure origins; over plain http in the LAN
			// fall back to selecting the text and the legacy copy command.
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(link);
			} else {
				inputRef.current?.select();
				if (!document.execCommand("copy")) throw new Error();
			}
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			inputRef.current?.select();
			toast({ tone: "info", title: "Copy the selected link manually" });
		}
	};

	const share = () =>
		void navigator.share({ title: "NodePilot invite", text: "Create your NodePilot account:", url: link }).catch(() => undefined);

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -6 }}
			className="border-2 border-ink bg-accent p-4 shadow-[4px_4px_0_var(--ink)]"
		>
			<div className="flex items-start justify-between gap-3">
				<p className="flex items-center gap-2 text-sm font-bold uppercase">
					<Send className="size-4" /> {invitation.role} invite ready
				</p>
				<button type="button" onClick={onDismiss} className="grid size-7 place-items-center border-2 border-ink bg-surface" aria-label="Hide link">
					<X className="size-3.5" />
				</button>
			</div>
			<p className="mt-1 font-mono text-xs leading-5">
				Send it to the person you&apos;re inviting. It&apos;s shown only now and expires {formatRelative(invitation.expiresAtUtc)}.
			</p>
			<div className="mt-3 flex items-stretch border-2 border-ink bg-surface">
				<input
					ref={inputRef}
					readOnly
					value={link}
					onFocus={(event) => event.currentTarget.select()}
					className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-ink outline-none"
					aria-label="Invite link"
				/>
				<button
					type="button"
					onClick={() => void copy()}
					className="flex shrink-0 items-center gap-1.5 border-l-2 border-ink px-3 font-mono text-xs font-bold uppercase transition hover:bg-ground"
				>
					{copied ? <Check className="size-4" /> : <Copy className="size-4" />}
					{copied ? "Copied" : "Copy"}
				</button>
				{canShare ? (
					<button
						type="button"
						onClick={share}
						className="grid w-11 shrink-0 place-items-center border-l-2 border-ink transition hover:bg-ground"
						aria-label="Share link"
					>
						<Share2 className="size-4" />
					</button>
				) : null}
			</div>
		</motion.div>
	);
}

export function RoleBadge({ role }: { role: UserRole }) {
	return (
		<span
			className={
				role === "Admin"
					? "shrink-0 border-2 border-ink bg-ink px-2 py-0.5 font-mono text-[0.65rem] font-bold uppercase text-accent"
					: "shrink-0 border-2 border-ink bg-ground px-2 py-0.5 font-mono text-[0.65rem] font-bold uppercase text-ink"
			}
		>
			{role}
		</span>
	);
}
