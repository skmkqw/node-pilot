"use client";

import { motion } from "motion/react";
import { FolderOpen, LayoutDashboard, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
	{ href: "/", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/files", label: "Files & Media", icon: FolderOpen },
	{ href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
	return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const { user, logout } = useAuth();

	return (
		<div className="min-h-screen lg:pl-[18.5rem]">
			{/* Desktop sidebar */}
			<motion.aside
				initial={{ x: -24, opacity: 0 }}
				animate={{ x: 0, opacity: 1 }}
				transition={{ type: "spring", stiffness: 260, damping: 30 }}
				className="glass fixed inset-y-4 left-4 z-40 hidden w-64 flex-col rounded-[1.75rem] p-4 lg:flex"
			>
				<Link href="/" className="flex items-center gap-3 px-2 py-2">
					<Logo size={38} />
					<div>
						<p className="text-[0.95rem] font-semibold tracking-tight text-white">NodePilot</p>
						<p className="text-[0.68rem] uppercase tracking-[0.22em] text-muted">Home server</p>
					</div>
				</Link>

				<div className="mx-2 my-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

				<nav className="flex flex-col gap-1">
					{NAV_ITEMS.map((item) => {
						const active = isActive(pathname, item.href);
						const Icon = item.icon;

						return (
							<Link
								key={item.href}
								href={item.href}
								className={cn(
									"relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
									active ? "text-white" : "text-slate-400 hover:text-slate-200",
								)}
							>
								{active ? (
									<motion.span
										layoutId="sidebar-active"
										transition={{ type: "spring", stiffness: 420, damping: 34 }}
										className="absolute inset-0 rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-400/15 via-sky-400/10 to-violet-400/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
									/>
								) : null}
								<Icon className={cn("relative size-[1.15rem]", active && "text-cyan-300")} />
								<span className="relative">{item.label}</span>
								{active ? (
									<motion.span
										layoutId="sidebar-dot"
										className="relative ml-auto size-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(103,232,249,0.7)]"
									/>
								) : null}
							</Link>
						);
					})}
				</nav>

				<div className="mt-auto rounded-2xl border border-white/8 bg-white/[0.03] p-3">
					<div className="flex items-center gap-3">
						<div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-sm font-semibold text-slate-950">
							{user?.username.slice(0, 1).toUpperCase()}
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium text-white">{user?.username}</p>
							<p className="flex items-center gap-1.5 text-[0.7rem] text-emerald-300/90">
								<span className="relative flex size-1.5">
									<span className="absolute inline-flex size-full rounded-full bg-emerald-400 animate-ping-slow" />
									<span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
								</span>
								Administrator
							</p>
						</div>
						<button
							type="button"
							onClick={() => void logout()}
							className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-rose-300"
							aria-label="Sign out"
							title="Sign out"
						>
							<LogOut className="size-4" />
						</button>
					</div>
				</div>
			</motion.aside>

			{/* Mobile top bar */}
			<header className="sticky top-0 z-30 flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),1rem)] lg:hidden">
				<Link href="/" className="flex items-center gap-2.5">
					<Logo size={32} />
					<span className="font-semibold tracking-tight text-white">NodePilot</span>
				</Link>
				<button
					type="button"
					onClick={() => void logout()}
					className="glass grid size-10 place-items-center rounded-2xl text-slate-300"
					aria-label="Sign out"
				>
					<LogOut className="size-4" />
				</button>
			</header>

			<main className="mx-auto w-full max-w-[1400px] px-4 pb-32 pt-2 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
				<motion.div
					key={pathname}
					initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
				>
					{children}
				</motion.div>
			</main>

			{/* Mobile tab bar */}
			<nav className="glass fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1rem)] z-40 flex rounded-[1.4rem] p-1.5 lg:hidden">
				{NAV_ITEMS.map((item) => {
					const active = isActive(pathname, item.href);
					const Icon = item.icon;

					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[0.7rem] font-medium transition-colors",
								active ? "text-white" : "text-slate-400",
							)}
						>
							{active ? (
								<motion.span
									layoutId="tabbar-active"
									transition={{ type: "spring", stiffness: 420, damping: 34 }}
									className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 to-white/[0.03]"
								/>
							) : null}
							<Icon className={cn("relative size-5", active && "text-cyan-300")} />
							<span className="relative">{item.label}</span>
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
