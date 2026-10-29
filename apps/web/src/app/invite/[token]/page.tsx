"use client";

import { motion } from "motion/react";
import { ArrowRight, KeyRound, Link2Off, User, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PasswordStrength } from "@/components/settings/password-strength";
import { OfflineScreen } from "@/components/shell/offline-screen";
import { Splash } from "@/components/shell/splash";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, PasswordField, inputClassName } from "@/components/ui/field";
import { Logo } from "@/components/ui/logo";
import { ApiError } from "@/lib/api/client";
import { invitationsApi } from "@/lib/api/endpoints";
import type { InvitationPreview } from "@/lib/api/types";
import { formatRelative } from "@/lib/format";

type PreviewState =
	| { kind: "loading" }
	| { kind: "valid"; preview: InvitationPreview }
	| { kind: "invalid" }
	| { kind: "error"; message: string }
	| { kind: "offline" };

export default function InvitePage() {
	const { token } = useParams<{ token: string }>();
	const [state, setState] = useState<PreviewState>({ kind: "loading" });
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		const controller = new AbortController();

		invitationsApi
			.preview(token, controller.signal)
			.then((preview) => setState({ kind: "valid", preview }))
			.catch((error: unknown) => {
				if (error instanceof DOMException && error.name === "AbortError") return;
				// Only 404 means the link itself is bad; anything else (e.g. 429) is worth retrying.
				if (error instanceof ApiError && error.status === 404) setState({ kind: "invalid" });
				else if (error instanceof ApiError && error.status !== 0) setState({ kind: "error", message: error.message });
				else setState({ kind: "offline" });
			});

		return () => controller.abort();
	}, [token, attempt]);

	if (state.kind === "loading") return <Splash message="Checking invite…" />;
	const retry = () => {
		setState({ kind: "loading" });
		setAttempt((value) => value + 1);
	};

	if (state.kind === "offline") return <OfflineScreen onRetry={retry} />;

	return (
		<div className="grid min-h-screen place-items-center px-4 py-10">
			<motion.div
				initial={{ opacity: 0, y: 24 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ type: "spring", stiffness: 380, damping: 32 }}
				className="w-full max-w-lg"
			>
				<div className="mb-8 flex items-center gap-4">
					<Logo size={56} />
					<div>
						<p className="label text-muted">Invitation · Unit 01</p>
						<h1 className="text-3xl font-bold uppercase leading-tight">Join NodePilot</h1>
					</div>
				</div>

				<div className="panel p-6 sm:p-8">
					{state.kind === "valid" ? <AcceptForm token={token} preview={state.preview} /> : null}
					{state.kind === "invalid" ? <InvalidLink /> : null}
					{state.kind === "error" ? <LoadError message={state.message} onRetry={retry} /> : null}
				</div>
			</motion.div>
		</div>
	);
}

function AcceptForm({ token, preview }: { token: string; preview: InvitationPreview }) {
	const { acceptInvite } = useAuth();
	const router = useRouter();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const mismatch = confirm.length > 0 && confirm !== password;
	const canSubmit = /^[A-Za-z0-9._-]{3,32}$/.test(username.trim()) && password.length >= 8 && password === confirm;

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			await acceptInvite(token, username.trim(), password);
			router.replace("/");
		} catch (caught) {
			setError((caught as Error).message);
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={submit} className="space-y-5">
			<div>
				<p className="label flex items-center gap-2 text-muted">
					<UserPlus className="size-4" /> Invited by {preview.invitedBy} · {preview.role}
				</p>
				<h2 className="mt-1 text-xl font-bold uppercase">Create your account</h2>
				<p className="mt-1 font-mono text-xs text-muted">
					This link works once and expires {formatRelative(preview.expiresAtUtc)}.
				</p>
			</div>

			<Field icon={<User className="size-4" />} label="Username" hint="3–32 characters: letters, digits, . _ -">
				<input
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					autoComplete="username"
					autoFocus
					required
					className={inputClassName}
				/>
			</Field>

			<div>
				<PasswordField
					icon={<KeyRound className="size-4" />}
					label="Password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					autoComplete="new-password"
					required
				/>
				<PasswordStrength password={password} />
			</div>

			<PasswordField
				icon={<KeyRound className="size-4" />}
				label="Repeat password"
				hint={mismatch ? <span className="font-bold text-danger">THE PASSWORDS DO NOT MATCH.</span> : undefined}
				value={confirm}
				onChange={(event) => setConfirm(event.target.value)}
				autoComplete="new-password"
				required
			/>

			{error ? <p className="border-2 border-ink bg-alert px-3 py-2.5 font-mono text-sm font-bold">{error}</p> : null}

			<Button type="submit" variant="primary" size="lg" className="group w-full" isLoading={isSubmitting} disabled={!canSubmit}>
				Create account
				{!isSubmitting ? <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /> : null}
			</Button>
		</form>
	);
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div className="flex flex-col items-center py-2 text-center">
			<h2 className="text-2xl font-bold uppercase">Couldn&apos;t open the invite</h2>
			<p className="mt-2 max-w-sm font-mono text-xs leading-5 text-muted">{message}</p>
			<Button variant="secondary" className="mt-7" onClick={onRetry}>
				Try again
			</Button>
		</div>
	);
}

function InvalidLink() {
	return (
		<div className="flex flex-col items-center py-2 text-center">
			<div className="grid size-16 place-items-center border-2 border-ink bg-alert shadow-[5px_5px_0_var(--ink)]">
				<Link2Off className="size-7" />
			</div>
			<h2 className="mt-6 text-2xl font-bold uppercase">Link not valid</h2>
			<p className="mt-2 max-w-sm font-mono text-xs leading-5 text-muted">
				This invite link has expired, was already used or was revoked. Ask the administrator for a new one.
			</p>
			<Link href="/login" className={buttonStyles("secondary", "md", "mt-7")}>
				Go to sign in
			</Link>
		</div>
	);
}
