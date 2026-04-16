import { StatusPage } from "@/components/status/status-page";

export default function HomePage() {
	return (
		<main className="relative min-h-screen overflow-hidden">
			<div className="pointer-events-none absolute -left-40 -top-32 h-64 w-64 rounded-full bg-cyan-400/20 blur-[72px] sm:h-[28rem] sm:w-[28rem]" />
			<section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
				<header className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(8,145,178,0.2),rgba(15,23,42,0.1)_44%,rgba(15,23,42,0.9)),rgba(15,23,42,0.8)] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[18px] sm:p-8">
					<div className="inline-flex items-center gap-2.5 rounded-full border border-slate-400/15 bg-slate-900/50 px-3.5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-sky-200">
						<span className="h-[0.55rem] w-[0.55rem] shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_0.32rem_rgba(52,211,153,0.14)]" />
						Live infrastructure pulse
					</div>
					<div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
						<div className="max-w-3xl">
							<h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
								NodePilot status center
							</h1>
							<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
								A calmer, faster view of your home server health with live
								utilization snapshots and a layout that holds up on small screens.
							</p>
						</div>

						<div className="max-w-[18rem] rounded-3xl border border-slate-400/15 bg-slate-900/45 px-4 py-4 backdrop-blur-[16px]">
							<p className="text-xs uppercase tracking-[0.28em] text-cyan-200/80">
								Monitoring
							</p>
							<p className="mt-3 text-sm text-slate-200">
								Auto-refreshing system vitals every 5 seconds.
							</p>
						</div>
					</div>
				</header>

				<div className="mt-6 flex-1 sm:mt-8">
					<StatusPage />
				</div>
			</section>
		</main>
	);
}
