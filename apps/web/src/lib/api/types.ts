// DTOs mirroring the NodePilot backend contract (enums are serialized as strings).

export type MetricCollectionStatus = "Success" | "PartialSuccess" | "ReadFailed";

export type SystemMetric = {
	id: number;
	cpuEnabled: boolean;
	cpuUsagePercent: number | null;
	ramEnabled: boolean;
	ramUsagePercent: number | null;
	cpuTemperatureCelsius: number | null;
	status: MetricCollectionStatus;
	totalReads: number;
	successfulReads: number;
	failureReason: string | null;
	collectedAtUtc: string;
};

export type IntervalMetricsSummary = {
	totalSamples: number;
	successfulSamples: number;
	partialSuccessSamples: number;
	failedSamples: number;
	collectionSuccessRatePercent: number;
	cpuMeasuredSamples: number;
	cpuCoveragePercent: number;
	ramMeasuredSamples: number;
	ramCoveragePercent: number;
	temperatureMeasuredSamples: number;
	intervalStart: string;
	intervalEnd: string;
	intervalDurationSeconds: number;
	averageCpuUsagePercent: number | null;
	minCpuUsagePercent: number | null;
	maxCpuUsagePercent: number | null;
	averageRamUsagePercent: number | null;
	minRamUsagePercent: number | null;
	maxRamUsagePercent: number | null;
	averageCpuTemperatureCelsius: number | null;
	minCpuTemperatureCelsius: number | null;
	maxCpuTemperatureCelsius: number | null;
};

export type MemoryInfo = {
	totalMemoryBytes: number;
	usedMemoryBytes: number;
	availableMemoryBytes: number;
	ramUsagePercent: number;
};

export type DiskUsage = {
	mountPoint: string;
	totalBytes: number;
	usedBytes: number;
	availableBytes: number;
	usagePercent: number;
};

export type SystemOverview = {
	hostname: string;
	operatingSystem: string;
	architecture: string;
	processorCount: number;
	uptimeSeconds: number | null;
	loadAverage: {
		oneMinute: number;
		fiveMinutes: number;
		fifteenMinutes: number;
	} | null;
	memory: MemoryInfo | null;
	cpuTemperatureCelsius: number | null;
	disk: DiskUsage | null;
	collectedAtUtc: string;
};

export type FileKind =
	| "Directory"
	| "Video"
	| "Audio"
	| "Image"
	| "Document"
	| "Archive"
	| "Code"
	| "Other";

export type FileEntry = {
	name: string;
	path: string;
	kind: FileKind;
	sizeBytes: number | null;
	modifiedAtUtc: string;
	isPlayable: boolean;
};

export type DirectoryListing = {
	path: string;
	parentPath: string | null;
	entries: FileEntry[];
	directoryCount: number;
	fileCount: number;
	totalSizeBytes: number;
};

export type AdBlockerStatus = {
	configured: boolean;
	reachable: boolean;
	blockingEnabled: boolean | null;
	blockingTimerSeconds: number | null;
	totalQueries: number | null;
	blockedQueries: number | null;
	percentBlocked: number | null;
	activeClients: number | null;
	domainsOnBlocklist: number | null;
	message: string | null;
	checkedAtUtc: string;
};

export type UserRole = "Admin" | "Member";

export type CurrentUser = {
	username: string;
	role: UserRole;
};

export type AuthStatus = {
	setupRequired: boolean;
	authenticated: boolean;
	username: string | null;
	role: UserRole | null;
};

export type UserSummary = {
	id: number;
	username: string;
	role: UserRole;
	createdAtUtc: string;
};

export type InvitationSummary = {
	id: number;
	role: UserRole;
	createdBy: string;
	createdAtUtc: string;
	expiresAtUtc: string;
};

/** Returned once on creation; the token cannot be retrieved again. */
export type CreatedInvitation = {
	id: number;
	token: string;
	role: UserRole;
	expiresAtUtc: string;
};

export type InvitationPreview = {
	role: UserRole;
	invitedBy: string;
	expiresAtUtc: string;
};

export type PiHoleSettingsSource = "None" | "App" | "Environment";

export type PiHoleConnectionInfo = {
	baseUrl: string | null;
	hasPassword: boolean;
	source: PiHoleSettingsSource;
};
