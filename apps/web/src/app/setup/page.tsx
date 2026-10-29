"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, KeyRound, ShieldCheck, Sparkles, User, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PasswordStrength } from "@/components/settings/password-strength";
import { PiHoleForm } from "@/components/settings/pihole-form";
import { OfflineScreen } from "@/components/shell/offline-screen";
import { Splash } from "@/components/shell/splash";
import { Button } from "@/components/ui/button";
import { Field, PasswordField, inputClassName } from "@/components/ui/field";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const STEPS = [
	{ title: "Account", icon: UserPlus },
	{ title: "Ad blocker", icon: ShieldCheck },
	{ title: "Done", icon: Sparkles },
];

const slide = {
	initial: { opacity: 0, x: 40 },
	animate: { opacity: 1, x: 0 },
	exit: { opacity: 0, x: -40 },
};

export default function SetupPage() {
	const { status, retry } = useAuth();
	const router = useRouter();
	const [step, setStep] = useState(0);

	useEffect(() => {
		if (status === "anonymous") router.replace("/login");
		// Signed in but not in the middle of the wizard: setup was finished earlier.
		if (status === "authenticated" && step === 0) router.replace("/");
	}, [status, step, router]);

	if (status === "loading") return <Splash />;
	if (status === "offline") return <OfflineScreen onRetry={retry} />;
	if (status === "anonymous" || (status === "authenticated" && step === 0)) return <Splash />;

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
						<p className="label text-muted">First start · Unit 01</p>
						<h1 className="text-3xl font-bold uppercase leading-tight">Welcome to NodePilot</h1>
					</div>
				</div>

				<Stepper step={step} />

				<div className="panel mt-6">
					<AnimatePresence mode="wait" initial={false}>
						<motion.div
							key={step}
							variants={slide}
							initial="initial"
							animate="animate"
							exit="exit"
							transition={{ type: "spring", stiffness: 520, damping: 40 }}
							className="p-6 sm:p-8"
						>
							{step === 0 ? <AccountStep onDone={() => setStep(1)} /> : null}
							{step === 1 ? <PiHoleStep onDone={() => setStep(2)} /> : null}
							{step === 2 ? <DoneStep onFinish={() => router.replace("/")} /> : null}
						</motion.div>
					</AnimatePresence>
				</div>
			</motion.div>
		</div>
	);
}

function Stepper({ step }: { step: number }) {
	return (
		<ol className="grid grid-cols-3 border-2 border-ink bg-surface">
			{STEPS.map((item, index) => {
				const done = index < step;
				const active = index === step;

				return (
					<li key={item.title} className={cn("relative flex items-center gap-2 px-3 py-2.5", index > 0 && "border-l-2 border-ink")}>
						{active ? <motion.span layoutId="setup-step" transition={{ type: "spring", stiffness: 600, damping: 40 }} className="absolute inset-0 bg-ink" /> : null}
						<span
							className={cn(
								"relative grid size-7 shrink-0 place-items-center border-2 font-mono text-xs font-bold",
								done && "border-ink bg-ok",
								active && "border-accent bg-accent text-ink",
								!done && !active && "border-ink bg-ground",
							)}
						>
							{done ? <Check className="size-4" /> : index + 1}
						</span>
						<span className={cn("label relative truncate", active ? "text-accent" : "text-ink")}>{item.title}</span>
					</li>
				);
			})}
		</ol>
	);
}

function AccountStep({ onDone }: { onDone: () => void }) {
	const { setup } = useAuth();
	const [username, setUsername] = useState("admin");
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
			await setup(username.trim(), password);
			onDone();
		} catch (caught) {
			setError((caught as Error).message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={submit} className="space-y-5">
			<div>
				<p className="label text-muted">Step 1 / 3</p>
				<h2 className="text-xl font-bold uppercase">Create the administrator account</h2>
				<p className="mt-1 font-mono text-xs text-muted">You&apos;ll use it to sign in to NodePilot from any device.</p>
			</div>

			<Field icon={<User className="size-4" />} label="Username" hint="3–32 characters: letters, digits, . _ -">
				<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required className={inputClassName} />
			</Field>

			<div>
				<PasswordField
					icon={<KeyRound className="size-4" />}
					label="Password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					autoComplete="new-password"
					autoFocus
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

function PiHoleStep({ onDone }: { onDone: () => void }) {
	return (
		<div className="space-y-5">
			<div>
				<p className="label text-muted">Step 2 / 3 · Optional</p>
				<h2 className="text-xl font-bold uppercase">Connect your Pi-hole</h2>
				<p className="mt-1 font-mono text-xs text-muted">
					Lets you switch network-wide ad blocking from the dashboard. You can do this later in Settings.
				</p>
			</div>
			<PiHoleForm
				info={null}
				onSaved={onDone}
				secondaryAction={
					<Button type="button" variant="ghost" onClick={onDone}>
						Skip for now
					</Button>
				}
			/>
		</div>
	);
}

function DoneStep({ onFinish }: { onFinish: () => void }) {
	return (
		<div className="flex flex-col items-center py-2 text-center">
			<motion.div
				initial={{ scale: 0.6, rotate: -8 }}
				animate={{ scale: 1, rotate: 0 }}
				transition={{ type: "spring", stiffness: 500, damping: 18 }}
				className="grid size-20 place-items-center border-2 border-ink bg-ok shadow-[6px_6px_0_var(--ink)]"
			>
				<svg viewBox="0 0 48 48" className="size-11" aria-hidden>
					<motion.path
						d="M11 25 l9 9 l17 -19"
						fill="none"
						stroke="var(--ink)"
						strokeWidth="5"
						strokeLinecap="square"
						initial={{ pathLength: 0 }}
						animate={{ pathLength: 1 }}
						transition={{ duration: 0.35, delay: 0.25 }}
					/>
				</svg>
			</motion.div>
			<p className="label mt-6 text-muted">Step 3 / 3</p>
			<h2 className="text-2xl font-bold uppercase">You&apos;re all set</h2>
			<p className="mt-2 max-w-sm font-mono text-xs leading-5 text-muted">
				NodePilot is ready. The Pi-hole connection and your password can be changed any time in Settings.
			</p>
			<Button variant="primary" size="lg" className="group mt-7" onClick={onFinish}>
				Open dashboard <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
			</Button>
		</div>
	);
}
