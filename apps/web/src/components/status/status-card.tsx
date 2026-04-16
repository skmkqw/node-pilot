type StatusCardProps = {
    label: string;
    value: string;
    helper?: string;
    detail?: string;
    progress?: number;
    tone?: "neutral" | "cool" | "warning" | "danger";
    compact?: boolean;
};

const toneStyles = {
    neutral: {
        badge: "text-slate-300 bg-white/8 border-white/10",
        track: "bg-white/8",
        fill: "bg-slate-200",
    },
    cool: {
        badge: "text-cyan-100 bg-cyan-400/10 border-cyan-300/15",
        track: "bg-cyan-400/10",
        fill: "bg-cyan-300",
    },
    warning: {
        badge: "text-amber-100 bg-amber-400/10 border-amber-300/20",
        track: "bg-amber-400/10",
        fill: "bg-amber-300",
    },
    danger: {
        badge: "text-rose-100 bg-rose-400/10 border-rose-300/20",
        track: "bg-rose-400/10",
        fill: "bg-rose-300",
    },
} as const;

export function StatusCard({
    label,
    value,
    helper,
    detail,
    progress,
    tone = "neutral",
    compact = false,
}: StatusCardProps) {
    const styles = toneStyles[tone];

    return (
        <article
            className={[
                "rounded-[1.5rem] border border-white/10 bg-white/[0.045] shadow-[0_20px_45px_rgba(2,6,23,0.24)] backdrop-blur",
                compact ? "p-4" : "p-5 xl:p-6",
            ].join(" ")}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-300">{label}</p>
                    <p
                        className={[
                            "font-semibold tracking-tight text-white",
                            compact ? "mt-3 text-3xl" : "mt-4 text-3xl sm:text-[2rem]",
                        ].join(" ")}
                    >
                        {value}
                    </p>
                </div>

                <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] ${styles.badge}`}
                >
                    {getToneLabel(tone)}
                </span>
            </div>

            {helper ? (
                <p className="mt-3 text-sm leading-6 text-slate-300">{helper}</p>
            ) : null}

            {typeof progress === "number" ? (
                <div className="mt-5">
                    <div className={`h-2 overflow-hidden rounded-full ${styles.track}`}>
                        <div
                            className={`h-full rounded-full ${styles.fill}`}
                            style={{ width: `${Math.max(6, Math.min(progress, 100))}%` }}
                        />
                    </div>
                </div>
            ) : null}

            {!compact && detail ? (
                <p className="mt-4 text-sm leading-6 text-slate-400">{detail}</p>
            ) : null}
        </article>
    );
}

function getToneLabel(tone: NonNullable<StatusCardProps["tone"]>) {
    switch (tone) {
        case "cool":
            return "Healthy";
        case "warning":
            return "Watch";
        case "danger":
            return "High";
        default:
            return "Info";
    }
}
