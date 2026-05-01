import { SystemMetricDto } from "@/types/system-metric";

type MetricKey = "cpuUsagePercent" | "ramUsagePercent";

export type ChartPoint = {
    bucketTime: Date;
    sample: SystemMetricDto | null;
    state: "success" | "failed" | "missing";
    value: number | null;
    x: number;
    y: number;
};

export function buildHistorySeries(
    history: SystemMetricDto[],
    metric: MetricKey,
    startTimeUtc: string,
    endTimeUtc: string,
    intervalSeconds: number
) {
    const startTime = alignUtcBucket(new Date(startTimeUtc), intervalSeconds).getTime();
    const endTime = alignUtcBucket(new Date(endTimeUtc), intervalSeconds).getTime();
    const intervalMs = intervalSeconds * 1000;
    const duration = Math.max(endTime - startTime, intervalMs);
    const buckets = new Map<number, SystemMetricDto>();

    for (const sample of history) {
        const bucketTime = alignUtcBucket(
            new Date(sample.collectedAtUtc),
            intervalSeconds
        ).getTime();

        if (bucketTime < startTime || bucketTime > endTime) {
            continue;
        }

        buckets.set(bucketTime, sample);
    }

    const points: ChartPoint[] = [];

    for (let bucketTime = startTime; bucketTime <= endTime; bucketTime += intervalMs) {
        const sample = buckets.get(bucketTime) ?? null;
        const sampleValue = sample?.[metric] ?? null;
        const state = sample
            ? sample.status === 1 || sampleValue === null
                ? "failed"
                : "success"
            : "missing";
        const value =
            typeof sampleValue === "number"
                ? Math.max(0, Math.min(sampleValue, 100))
                : null;

        points.push({
            bucketTime: new Date(bucketTime),
            sample,
            state,
            value,
            x: 26 + ((bucketTime - startTime) / duration) * 948,
            y: value === null ? 314 : yForPercent(value),
        });
    }

    return {
        points,
        successCount: points.filter((point) => point.state === "success").length,
        failedCount: points.filter((point) => point.state === "failed").length,
        missingCount: points.filter((point) => point.state === "missing").length,
        expectedPoints: points.length,
    };
}

function alignUtcBucket(date: Date, intervalSeconds: number) {
    const aligned = new Date(date);
    const intervalMs = intervalSeconds * 1000;
    const alignedTime = Math.floor(aligned.getTime() / intervalMs) * intervalMs;

    aligned.setTime(alignedTime);

    return aligned;
}

function yForPercent(value: number) {
    return 24 + (1 - value / 100) * 276;
}
