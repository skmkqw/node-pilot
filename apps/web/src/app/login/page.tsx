"use client";

import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { Activity, ArrowRight, FolderOpen, Lock, ShieldCheck, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { OfflineScreen } from "@/components/shell/offline-screen";
import { Splash } from "@/components/shell/splash";
import { Button } from "@/components/ui/button";
import { Field, PasswordField, inputClassName } from "@/components/ui/field";
import { Logo } from "@/components/ui/logo";
import { Switch } from "@/components/ui/switch";

const FEATURES = [
	{ icon: Activity, channel: "CH-A–E", title: "Live monitoring", text: "CPU, memory, temperature and disk at a glance." },
	{ icon: FolderOpen, channel: "CH-H", title: "Files & media", text: "Browse, upload and stream videos in the browser." },
	{ icon: ShieldCheck, channel: "CH-F", title: "Ad blocking", text: "Switch network-wide Pi-hole filtering in one tap." },
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
	const { status, login, retry } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();
	const next = safeNextPath(searchParams.get("next"));

	const [username, setUsername] = useState("admin");
	const [password, setPassword] = useState("");
	const [rememberMe, setRememberMe] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const shake = useAnimationControls();

	useEffect(() => {
		if (status === "authenticated") {
			router.replace(next);
		} else if (status === "setup") {
			router.replace("/setup");
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
			void shake.start({ x: [0, -10, 10, -7, 7, -3, 3, 0], transition: { duration: 0.4 } });
		} finally {
			setIsSubmitting(false);
		}
	};

	if (status === "offline") {
		return <OfflineScreen onRetry={retry} />;
	}

	if (status !== "anonymous") {
		return <Splash />;
	}

	return (
		<div className="grid min-h-screen items-center gap-12 px-4 py-10 lg:grid-cols-[1.1fr_1fr] lg:px-16">
			{/* Brand column */}
			<motion.section
				initial="hidden"
				animate="show"
				variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
				className="hidden max-w-xl lg:block"
			>
				<motion.div variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }} className="label inline-flex items-center gap-2 border-2 border-ink bg-surface px-3 py-1.5">
					<span className="led size-2.5 animate-blink border-[1.5px] bg-ok" />
					Self-hosted · Private · Lightweight
				</motion.div>
				<motion.h1
					variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
					className="mt-6 text-6xl font-bold leading-[0.95] tracking-tight xl:text-7xl"
				>
					Your home server,
					<br />
					<span className="bg-ink px-2 text-accent">one panel.</span>
				</motion.h1>
				<motion.p variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} className="mt-6 max-w-md font-mono text-sm leading-6 text-muted">
					Everything your server does, in one place. No terminal, no ten different admin panels.
				</motion.p>

				<div className="mt-10 grid gap-4">
					{FEATURES.map((feature) => (
						<motion.div key={feature.title} variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } }} className="panel-sm flex items-center gap-4 p-3">
							<div className="grid size-11 shrink-0 place-items-center border-2 border-ink bg-accent">
								<feature.icon className="size-5" />
							</div>
							<div>
								<p className="label text-muted">{feature.channel}</p>
								<p className="font-bold uppercase leading-tight">{feature.title}</p>
								<p className="font-mono text-xs text-muted">{feature.text}</p>
							</div>
						</motion.div>
					))}
				</div>
			</motion.section>

			{/* Sign-in panel */}
			<motion.div
				initial={{ opacity: 0, y: 24 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ type: "spring", stiffness: 380, damping: 32 }}
				className="mx-auto w-full max-w-md"
			>
				<motion.form animate={shake} onSubmit={submit} className="panel">
					<div className="flex items-center justify-between border-b-2 border-ink bg-accent px-5 py-3">
						<span className="label">Access panel · Unit 01</span>
						<span className="led bg-ok" />
					</div>

					<div className="p-6 sm:p-8">
						<div className="flex items-center gap-4">
							<Logo size={56} />
							<div>
								<h2 className="text-2xl font-bold uppercase leading-tight">Welcome back</h2>
								<p className="font-mono text-xs text-muted">Sign in to your NodePilot control panel</p>
							</div>
						</div>

						<div className="mt-8 space-y-5">
							<Field icon={<User className="size-4" />} label="Username">
								<input
									value={username}
									onChange={(event) => setUsername(event.target.value)}
									autoComplete="username"
									required
									className={inputClassName}
									placeholder="admin"
								/>
							</Field>

							<PasswordField
								icon={<Lock className="size-4" />}
								label="Password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								autoComplete="current-password"
								required
								autoFocus
								placeholder="••••••••"
							/>

							<label className="flex cursor-pointer items-center justify-between gap-4">
								<span className="label">Keep me signed in</span>
								<Switch checked={rememberMe} onChange={setRememberMe} label="Keep me signed in" />
							</label>

							<AnimatePresence>
								{error ? (
									<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
										<div className="flex items-center gap-3 border-2 border-ink bg-alert px-3 py-2.5 font-mono text-sm font-bold">
											<span className="led animate-blink bg-surface" />
											{error}
										</div>
									</motion.div>
								) : null}
							</AnimatePresence>

							<Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="group w-full">
								{isSubmitting ? "Signing in…" : "Sign in"}
								{!isSubmitting ? <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /> : null}
							</Button>
						</div>
					</div>
				</motion.form>
			</motion.div>
		</div>
	);
}
