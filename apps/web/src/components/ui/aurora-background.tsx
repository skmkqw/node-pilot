/**
 * Slowly drifting colour blobs behind the whole app. Pure CSS animation, so it costs
 * nothing on the main thread and stops for users who prefer reduced motion.
 */
export function AuroraBackground() {
	return (
		<div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
			<div className="absolute -left-[10%] -top-[20%] h-[60vh] w-[60vw] rounded-full bg-cyan-500/20 blur-[120px] animate-aurora-1" />
			<div className="absolute -right-[15%] top-[10%] h-[55vh] w-[50vw] rounded-full bg-violet-600/20 blur-[130px] animate-aurora-2" />
			<div className="absolute bottom-[-25%] left-[25%] h-[50vh] w-[55vw] rounded-full bg-emerald-500/10 blur-[140px] animate-aurora-3" />
			<div className="grid-overlay absolute inset-0" />
			<div className="grain absolute inset-0" />
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,rgba(4,6,12,0.6)_70%)]" />
		</div>
	);
}
