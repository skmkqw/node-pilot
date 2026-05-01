export type SystemStatusDto = {
	cpuUsagePercent: number;
	ramUsagePercent: number;
	status: 0 | 1,
    failureReason: string | null;
	collectedAtUtc: string;
};