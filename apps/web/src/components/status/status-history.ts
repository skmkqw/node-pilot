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
    const startTime = alignUtcBucket(
        parseUtcDate(startTimeUtc),
        intervalSeconds
    ).getTime();

    const endTime = alignUtcBucket(
        parseUtcDate(endTimeUtc),
        intervalSeconds
    ).getTime();

    const intervalMs = intervalSeconds * 1000;
    const duration = Math.max(endTime - startTime, intervalMs);
    const buckets = new Map<number, SystemMetricDto>();

    for (const sample of history) {
        const bucketTime = alignUtcBucket(
            parseUtcDate(sample.collectedAtUtc),
            intervalSeconds
        ).getTime();

        if (bucketTime < startTime || bucketTime > endTime) {
            continue;
        }

        buckets.set(bucketTime, sample);
    }

    const points: ChartPoint[] = [];

    for (
        let bucketTime = startTime;
        bucketTime <= endTime;
        bucketTime += intervalMs
    ) {
        const sample = buckets.get(bucketTime) ?? null;
        const sampleValue = sample?.[metric] ?? null;

        const value =
            typeof sampleValue === "number"
                ? Math.max(0, Math.min(sampleValue, 100))
                : null;

        const state: ChartPoint["state"] = sample
            ? sample.status === 1 || value === null
                ? "failed"
                : "success"
            : "missing";

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

function alignUtcBucket(date: Date, intervalSeconds: number): Date {
    const intervalMs = intervalSeconds * 1000;
    const alignedTime = Math.floor(date.getTime() / intervalMs) * intervalMs;

    return new Date(alignedTime);
}

function parseUtcDate(value: string): Date {
    if (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)) {
        return new Date(value);
    }

    return new Date(`${value}Z`);
}

function yForPercent(value: number): number {
    return 24 + (1 - value / 100) * 276;
}