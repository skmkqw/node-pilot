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
	initial: (direction: number) => ({ opacity: 0, x: direction * 40, filter: "blur(4px)" }),
	animate: { opacity: 1, x: 0, filter: "blur(0px)" },
	exit: (direction: number) => ({ opacity: 0, x: direction * -40, filter: "blur(4px)" }),
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
				initial={{ opacity: 0, y: 24, scale: 0.97 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ type: "spring", stiffness: 200, damping: 26 }}
				className="w-full max-w-lg"
			>
				<div className="mb-8 flex flex-col items-center text-center">
					<Logo size={52} />
					<h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Welcome to NodePilot</h1>
					<p className="mt-1.5 text-sm text-muted">Let&apos;s get your home server ready. It only takes a minute.</p>
				</div>

				<Stepper step={step} />

				<div className="glass relative mt-6 overflow-hidden rounded-[2rem] p-7 sm:p-8">
					<div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-cyan-400/15 blur-3xl" />
					<AnimatePresence mode="wait" custom={1} initial={false}>
						<motion.div
							key={step}
							custom={1}
							variants={slide}
							initial="initial"
							animate="animate"
							exit="exit"
							transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
							className="relative"
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
		<div className="relative mx-auto flex max-w-sm items-center justify-between px-2">
			<div className="absolute inset-x-8 top-5 h-px bg-white/10">
				<motion.div
					className="h-full bg-gradient-to-r from-cyan-300 to-violet-300 shadow-[0_0_8px_rgba(103,232,249,0.8)]"
					initial={false}
					animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
					transition={{ type: "spring", stiffness: 120, damping: 22 }}
				/>
			</div>
			{STEPS.map((item, index) => {
				const done = index < step;
				const active = index === step;

				return (
					<div key={item.title} className="relative flex flex-col items-center gap-2">
						<motion.div
							initial={false}
							animate={{ scale: active ? 1.08 : 1 }}
							className={cn(
								"grid size-10 place-items-center rounded-2xl border transition-colors duration-300",
								done && "border-emerald-300/40 bg-emerald-400/20 text-emerald-200",
								active && "border-cyan-300/50 bg-cyan-400/15 text-cyan-200 shadow-[0_0_24px_-4px_rgba(34,211,238,0.8)]",
								!done && !active && "border-white/10 bg-[#0a0f1c] text-slate-500",
							)}
						>
							{done ? <Check className="size-4" /> : <item.icon className="size-4" />}
						</motion.div>
						<span className={cn("text-[0.7rem] font-medium", active ? "text-white" : "text-slate-500")}>{item.title}</span>
					</div>
				);
			})}
		</div>
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
		<form onSubmit={submit} className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold text-white">Create your administrator account</h2>
				<p className="mt-1 text-sm text-muted">You&apos;ll use it to sign in to NodePilot from any device.</p>
			</div>

			<Field icon={<User className="size-4" />} label="Username" hint="3–32 characters: letters, digits, . _ -">
				<input
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					autoComplete="username"
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
					autoFocus
					required
				/>
				<PasswordStrength password={password} />
			</div>

			<PasswordField
				icon={<KeyRound className="size-4" />}
				label="Repeat password"
				hint={mismatch ? <span className="text-rose-300">The passwords do not match.</span> : undefined}
				value={confirm}
				onChange={(event) => setConfirm(event.target.value)}
				autoComplete="new-password"
				required
			/>

			{error ? <p className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

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
				<h2 className="text-lg font-semibold text-white">Connect your Pi-hole</h2>
				<p className="mt-1 text-sm text-muted">
					Optional. Lets you switch network-wide ad blocking from the dashboard. You can do this later in Settings.
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
		<div className="flex flex-col items-center py-4 text-center">
			<div className="relative grid size-20 place-items-center">
				<motion.span
					className="absolute inset-0 rounded-full border border-emerald-300/40"
					animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
					transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
				/>
				<svg viewBox="0 0 80 80" className="size-20">
					<motion.circle
						cx="40"
						cy="40"
						r="34"
						fill="rgba(52,211,153,0.12)"
						stroke="#34d399"
						strokeWidth="3"
						initial={{ pathLength: 0 }}
						animate={{ pathLength: 1 }}
						transition={{ duration: 0.6, ease: "easeOut" }}
					/>
					<motion.path
						d="M26 41 l9 9 l19 -20"
						fill="none"
						stroke="#d1fae5"
						strokeWidth="4"
						strokeLinecap="round"
						strokeLinejoin="round"
						initial={{ pathLength: 0 }}
						animate={{ pathLength: 1 }}
						transition={{ duration: 0.4, delay: 0.5, ease: "easeOut" }}
					/>
				</svg>
			</div>
			<h2 className="mt-6 text-xl font-semibold text-white">You&apos;re all set</h2>
			<p className="mt-2 max-w-sm text-sm text-muted">
				NodePilot is ready. Everything else, including the Pi-hole connection and your password, can be changed in Settings.
			</p>
			<Button variant="primary" size="lg" className="group mt-7" onClick={onFinish}>
				Open dashboard <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
			</Button>
		</div>
	);
}
