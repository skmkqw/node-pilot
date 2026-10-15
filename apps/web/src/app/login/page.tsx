"use client";

import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { Activity, ArrowRight, Eye, EyeOff, FolderOpen, Lock, ShieldCheck, TriangleAlert, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Splash } from "@/components/shell/splash";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Switch } from "@/components/ui/switch";

const FEATURES = [
	{ icon: Activity, title: "Live monitoring", text: "CPU, memory, temperature and disk at a glance.", color: "#22d3ee" },
	{ icon: FolderOpen, title: "Files & media", text: "Browse, upload and stream videos in the browser.", color: "#a78bfa" },
	{ icon: ShieldCheck, title: "Ad blocking", text: "Switch network-wide Pi-hole filtering in one tap.", color: "#34d399" },
];

export default function LoginPage() {
	return (
		<Suspense fallback={<Splash message="Loading…" />}>
			<LoginScreen />
		</Suspense>
	);
}

function safeNextPath(value: string | null) {
	// Only allow same-app relative paths to avoid open redirects.
	return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function LoginScreen() {
	const { status, login } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();
	const next = safeNextPath(searchParams.get("next"));

	const [username, setUsername] = useState("admin");
	const [password, setPassword] = useState("");
	const [rememberMe, setRememberMe] = useState(true);
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const shake = useAnimationControls();

	useEffect(() => {
		if (status === "authenticated") {
			router.replace(next);
		}
	}, [status, router, next]);

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		setIsSubmitting(true);
		setError(null);

		try {
			await login(username.trim(), password, rememberMe);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Sign in failed.");
			void shake.start({ x: [0, -10, 10, -7, 7, -3, 3, 0], transition: { duration: 0.5 } });
		} finally {
			setIsSubmitting(false);
		}
	};

	if (status === "loading") {
		return <Splash />;
	}

	return (
		<div className="grid min-h-screen items-center px-4 py-10 lg:grid-cols-[1.1fr_1fr] lg:px-16">
			{/* Brand column */}
			<motion.section
				initial="hidden"
				animate="show"
				variants={{ show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } }}
				className="hidden max-w-xl lg:block"
			>
				<motion.div
					variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
					className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1.5 text-xs font-medium text-cyan-200"
				>
					<span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_2px_rgba(103,232,249,0.7)]" />
					Self-hosted · Private · Lightweight
				</motion.div>
				<motion.h1
					variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
					className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight text-white xl:text-6xl"
				>
					Your home server,
					<br />
					<span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
						beautifully simple.
					</span>
				</motion.h1>
				<motion.p
					variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
					className="mt-5 max-w-md text-base leading-7 text-muted"
				>
					One place for everything your server does. No terminal, no ten different admin panels.
				</motion.p>

				<div className="mt-10 grid gap-3">
					{FEATURES.map((feature) => (
						<motion.div
							key={feature.title}
							variants={{ hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0 } }}
							className="glass flex items-center gap-4 rounded-2xl p-4"
						>
							<div
								className="grid size-11 place-items-center rounded-xl border border-white/10"
								style={{ color: feature.color, background: `color-mix(in oklab, ${feature.color} 14%, transparent)` }}
							>
								<feature.icon className="size-5" />
							</div>
							<div>
								<p className="text-sm font-medium text-white">{feature.title}</p>
								<p className="text-xs text-muted">{feature.text}</p>
							</div>
						</motion.div>
					))}
				</div>
			</motion.section>

			{/* Sign-in card */}
			<motion.div
				initial={{ opacity: 0, y: 24, scale: 0.97 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ type: "spring", stiffness: 200, damping: 26 }}
				className="mx-auto w-full max-w-md"
			>
				<motion.form
					animate={shake}
					onSubmit={submit}
					className="glass relative overflow-hidden rounded-[2rem] p-7 sm:p-9"
				>
					<div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />

					<div className="relative flex flex-col items-center text-center">
						<div className="relative mb-5">
							<motion.div
								className="absolute -inset-4 rounded-full border border-dashed border-cyan-300/25"
								animate={{ rotate: 360 }}
								transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
							/>
							<motion.div
								className="absolute -inset-8 rounded-full border border-violet-300/10"
								animate={{ rotate: -360 }}
								transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
							/>
							<Logo size={60} />
						</div>
						<h2 className="text-2xl font-semibold tracking-tight text-white">Welcome back</h2>
						<p className="mt-1.5 text-sm text-muted">Sign in to your NodePilot control panel</p>
					</div>

					<div className="relative mt-8 space-y-4">
						<Field icon={<User className="size-4" />} label="Username">
							<input
								value={username}
								onChange={(event) => setUsername(event.target.value)}
								autoComplete="username"
								required
								className="h-12 w-full bg-transparent pr-4 text-sm text-white outline-none placeholder:text-slate-500"
								placeholder="admin"
							/>
						</Field>

						<Field
							icon={<Lock className="size-4" />}
							label="Password"
							trailing={
								<button
									type="button"
									onClick={() => setShowPassword((value) => !value)}
									className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:text-white"
									aria-label={showPassword ? "Hide password" : "Show password"}
								>
									{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
								</button>
							}
						>
							<input
								type={showPassword ? "text" : "password"}
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								autoComplete="current-password"
								required
								autoFocus
								className="h-12 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
								placeholder="••••••••"
							/>
						</Field>

						<label className="flex cursor-pointer items-center justify-between rounded-2xl px-1 py-1 text-sm text-slate-300">
							Keep me signed in
							<Switch checked={rememberMe} onChange={setRememberMe} label="Keep me signed in" />
						</label>

						<AnimatePresence>
							{error ? (
								<motion.div
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: "auto" }}
									exit={{ opacity: 0, height: 0 }}
									className="overflow-hidden"
								>
									<div className="flex items-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
										<TriangleAlert className="size-4 shrink-0" />
										{error}
									</div>
								</motion.div>
							) : null}
						</AnimatePresence>

						<Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="group w-full">
							{isSubmitting ? "Signing in…" : "Sign in"}
							{!isSubmitting ? (
								<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
							) : null}
						</Button>
					</div>
				</motion.form>

				<p className="mt-6 text-center text-xs text-slate-500">
					Credentials are configured on the server (<code className="text-slate-400">Auth__Password</code>).
				</p>
			</motion.div>
		</div>
	);
}

function Field({
	icon,
	label,
	trailing,
	children,
}: {
	icon: React.ReactNode;
	label: string;
	trailing?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
			<span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] pl-4 pr-1.5 text-slate-500 transition focus-within:border-cyan-300/50 focus-within:bg-white/[0.06] focus-within:text-cyan-300 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]">
				{icon}
				{children}
				{trailing}
			</span>
		</label>
	);
}
