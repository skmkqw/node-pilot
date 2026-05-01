import { SystemStatusDto } from "@/types/system-status";
import { StatusCard } from "./status-card";

export function StatusGrid({ status }: { status: SystemStatusDto }) {
    const collectedAt = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(new Date(status.collectedAtUtc));

    const stats = [
        {
            label: "CPU usage",
            value: `${status.cpuUsagePercent.toFixed(1)}%`,
            helper: "Current processor load",
            tone: getUsageTone(status.cpuUsagePercent),
            progress: Math.min(status.cpuUsagePercent, 100),
        },
        {
            label: "RAM usage",
            value: `${status.ramUsagePercent.toFixed(1)}%`,
            helper: `Current random access memory load`,
            tone: getUsageTone(status.ramUsagePercent),
            progress: Math.min(status.ramUsagePercent, 100),
        },
        {
            label: "Collected at",
            value: collectedAt,
            helper: "Timestamp from the backend payload",
            tone: "neutral" as const,
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {stats.map((item) => (
                <StatusCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    helper={item.helper}
                    tone={item.tone}
                    progress={item.progress}
                />
            ))}
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
