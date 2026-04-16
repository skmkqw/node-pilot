import { SystemStatusDto } from "@/types/system-status";
import { StatusCard } from "./status-card";

function formatBytesToGb(bytes: number): string {
    return (
        new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 1,
        }).format(bytes / 1024 / 1024 / 1024) + " GB"
    );
}

export function StatusGrid({ status }: { status: SystemStatusDto }) {
    const collectedAt = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(status.collectedAtUtc));

    const stats = [
        {
            label: "CPU usage",
            value: `${status.cpuUsagePercent.toFixed(1)}%`,
            helper: "Current processor load",
            detail: "Higher values over time can indicate sustained compute pressure.",
            tone: getUsageTone(status.cpuUsagePercent),
            progress: Math.min(status.cpuUsagePercent, 100),
        },
        {
            label: "RAM usage",
            value: `${status.ramUsagePercent.toFixed(1)}%`,
            helper: `${formatBytesToGb(status.usedMemoryBytes)} of ${formatBytesToGb(status.totalMemoryBytes)}`,
            detail: "Tracks how much active memory is currently in use.",
            tone: getUsageTone(status.ramUsagePercent),
            progress: Math.min(status.ramUsagePercent, 100),
        },
        {
            label: "Available memory",
            value: formatBytesToGb(status.availableMemoryBytes),
            helper: "Immediately available for new processes",
            detail: "Free headroom helps the system absorb sudden workload spikes.",
            tone: "cool" as const,
            progress: Math.min(
                (status.availableMemoryBytes / status.totalMemoryBytes) * 100,
                100
            ),
        },
        {
            label: "Collected at",
            value: collectedAt,
            helper: "Timestamp from the backend payload",
            detail: "Lets you quickly verify how fresh the reading is.",
            tone: "neutral" as const,
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
            {stats.map((item) => (
                <StatusCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    helper={item.helper}
                    detail={item.detail}
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
