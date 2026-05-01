import { SystemMetricDto } from "@/types/system-metric";
import { HistoricalMetricChart } from "./historical-metric-chart";
import { buildHistorySeries } from "./status-history";
import { StatusCard } from "./status-card";

type StatusDashboardProps = {
    status: SystemMetricDto;
    history: SystemMetricDto[];
    historyStartUtc: string;
    historyEndUtc: string;
    historyIntervalSeconds: number;
};

type Stat = {
    label: string;
    value: string;
    helper: string;
    tone?: "neutral" | "cool" | "warning" | "danger";
    progress?: number;
}

export function StatusDashboard({
    status,
    history,
    historyStartUtc,
    historyEndUtc,
    historyIntervalSeconds,
}: StatusDashboardProps) {
    const collectedAt = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(new Date(status.collectedAtUtc));

    const historySummary = buildHistorySeries(
        history,
        "cpuUsagePercent",
        historyStartUtc,
        historyEndUtc,
        historyIntervalSeconds
    );

    const stats: Stat[] = [
        {
            label: "CPU usage",
            value: `${status.cpuUsagePercent!.toFixed(1)}%`,
            helper: "Latest persisted processor load sample.",
            tone: getUsageTone(status.cpuUsagePercent!),
            progress: Math.min(status.cpuUsagePercent!, 100),
        },
        {
            label: "RAM usage",
            value: `${status.ramUsagePercent!.toFixed(1)}%`,
            helper: "Latest persisted memory load sample.",
            tone: getUsageTone(status.ramUsagePercent!),
            progress: Math.min(status.ramUsagePercent!, 100),
        },
        {
            label: "Collected at",
            value: collectedAt,
            helper: "Timestamp returned by the metrics API.",
            tone: "neutral" as const,
        },
        {
            label: "Historical integrity",
            value: `${historySummary.successCount}/${historySummary.expectedPoints}`,
            helper: `${historySummary.failedCount} failed reads and ${historySummary.missingCount} missing intervals over the last hour.`,
            tone:
                historySummary.failedCount > 0 || historySummary.missingCount > 0
                    ? "warning"
                    : ("cool" as const),
        },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {stats.map((item) => (
                <div key={item.label}>
                    <StatusCard
                        label={item.label}
                        value={item.value}
                        helper={item.helper}
                        tone={item.tone}
                        progress={item.progress}
                    />
                </div>
            ))}

            <HistoricalMetricChart
                title="CPU load"
                metric="cpuUsagePercent"
                description="One-minute backend snapshots for the rolling last hour. Successful samples draw the trend line, while unsuccessful or absent reads stay visible in the series."
                accent="cyan"
                history={history}
                startTimeUtc={historyStartUtc}
                endTimeUtc={historyEndUtc}
                intervalSeconds={historyIntervalSeconds}
            />

            <HistoricalMetricChart
                title="RAM load"
                metric="ramUsagePercent"
                description="Memory pressure across the same rolling window, with point-level details available on hover."
                accent="emerald"
                history={history}
                startTimeUtc={historyStartUtc}
                endTimeUtc={historyEndUtc}
                intervalSeconds={historyIntervalSeconds}
            />
        </div>
    );
}

function getUsageTone(value: number): "cool" | "warning" | "danger" {
    if (value >= 85) {
        return "danger";
    }

    if (value >= 65) {
        return "warning";
    }

    return "cool";
}
