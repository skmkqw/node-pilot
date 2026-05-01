export type SystemMetricDto = {
    id: number;
    cpuUsagePercent: number | null;
    ramUsagePercent: number | null;
    status: 0 | 1;
    failureReason: string | null;
    collectedAtUtc: string;
};
