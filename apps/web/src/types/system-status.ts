export type SystemStatusDto = {
	cpuUsagePercent: number;
	ramUsagePercent: number;
	totalMemoryBytes: number;
	usedMemoryBytes: number;
	availableMemoryBytes: number;
	collectedAtUtc: string;
};