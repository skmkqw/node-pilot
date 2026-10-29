"use client";

import { motion } from "motion/react";
import { FolderOpen, LayoutDashboard, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
	{ href: "/", label: "Dashboard", code: "01", icon: LayoutDashboard },
	{ href: "/files", label: "Files & Media", code: "02", icon: FolderOpen },
	{ href: "/settings", label: "Settings", code: "03", icon: Settings },
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
				initial={{ x: -32, opacity: 0 }}
				animate={{ x: 0, opacity: 1 }}
				transition={{ type: "spring", stiffness: 420, damping: 36 }}
				className="panel fixed inset-y-5 left-5 z-40 hidden w-64 flex-col lg:flex"
			>
				<Link href="/" className="flex items-center gap-3 border-b-2 border-ink bg-accent px-4 py-4">
					<Logo size={40} />
					<div>
						<p className="text-lg font-bold uppercase leading-none tracking-wide">NodePilot</p>
						<p className="label mt-1 text-ink/80">Unit 01 · Home server</p>
					</div>
				</Link>

				<nav className="flex flex-col gap-2 p-4" aria-label="Main">
					{NAV_ITEMS.map((item) => {
						const active = isActive(pathname, item.href);
						const Icon = item.icon;

						return (
							<Link
								key={item.href}
								href={item.href}
								className={cn(
									"relative flex min-h-11 items-center gap-3 border-2 px-3 font-mono text-sm font-bold uppercase transition-colors",
									active ? "border-ink text-accent" : "border-transparent text-ink hover:border-ink hover:bg-ground",
								)}
							>
								{active ? (
									<motion.span layoutId="sidebar-active" transition={{ type: "spring", stiffness: 600, damping: 40 }} className="absolute inset-0 bg-ink" />
								) : null}
								<span className={cn("relative text-[0.65rem]", active ? "text-accent/80" : "text-muted")}>{item.code}</span>
								<Icon className="relative size-4" />
								<span className="relative">{item.label}</span>
							</Link>
						);
					})}
				</nav>

				<div className="mt-auto border-t-2 border-ink p-4">
					<div className="flex items-center gap-3">
						<div className="grid size-10 place-items-center border-2 border-ink bg-ground font-mono text-base font-bold">
							{user?.username.slice(0, 1).toUpperCase()}
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-bold">{user?.username}</p>
							<p className="label flex items-center gap-1.5 text-muted">
								<span className="led size-2.5 border-[1.5px] bg-ok" />
								Admin
							</p>
						</div>
						<button
							type="button"
							onClick={() => void logout()}
							className="grid size-10 place-items-center border-2 border-ink bg-surface shadow-[3px_3px_0_var(--ink)] transition hover:bg-alert active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
							aria-label="Sign out"
							title="Sign out"
						>
							<LogOut className="size-4" />
						</button>
					</div>
				</div>
			</motion.aside>

			{/* Mobile top bar */}
			<header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-ink bg-ground px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] lg:hidden">
				<Link href="/" className="flex items-center gap-2.5">
					<Logo size={34} />
					<span className="text-lg font-bold uppercase tracking-wide">NodePilot</span>
				</Link>
				<button
					type="button"
					onClick={() => void logout()}
					className="grid size-10 place-items-center border-2 border-ink bg-surface shadow-[3px_3px_0_var(--ink)]"
					aria-label="Sign out"
				>
					<LogOut className="size-4" />
				</button>
			</header>

			<main className="mx-auto w-full max-w-[1400px] px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
				<motion.div
					key={pathname}
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ type: "spring", stiffness: 420, damping: 36 }}
				>
					{children}
				</motion.div>
			</main>

			{/* Mobile tab bar */}
			<nav
				aria-label="Main"
				className="panel fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1rem)] z-40 grid grid-cols-3 lg:hidden"
			>
				{NAV_ITEMS.map((item, index) => {
					const active = isActive(pathname, item.href);
					const Icon = item.icon;

					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"relative flex min-h-14 flex-col items-center justify-center gap-1 font-mono text-[0.65rem] font-bold uppercase",
								index > 0 && "border-l-2 border-ink",
								active ? "text-accent" : "text-ink",
							)}
						>
							{active ? (
								<motion.span layoutId="tabbar-active" transition={{ type: "spring", stiffness: 600, damping: 40 }} className="absolute inset-0 bg-ink" />
							) : null}
							<Icon className="relative size-5" />
							<span className="relative">{item.label.split(" ")[0]}</span>
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
