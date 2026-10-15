const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"];

export function formatBytes(bytes: number | null | undefined, fractionDigits = 1): string {
	if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
		return "—";
	}

	if (bytes < 1024) {
		return `${bytes} B`;
	}

	const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
	const value = bytes / 1024 ** exponent;

	return `${value.toFixed(value >= 100 ? 0 : fractionDigits)} ${BYTE_UNITS[exponent]}`;
}

export function formatDuration(totalSeconds: number | null | undefined): string {
	if (totalSeconds === null || totalSeconds === undefined) {
		return "—";
	}

	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);

	if (days > 0) {
		return `${days}d ${hours}h`;
	}

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}

	return `${Math.max(minutes, 0)}m`;
}

export function formatCompact(value: number | null | undefined): string {
	if (value === null || value === undefined) {
		return "—";
	}

	return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatTime(value: string | Date): string {
	return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
		new Date(value),
	);
}

export function formatDateTime(value: string | Date): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
		new Date(value),
	);
}

export function formatRelative(value: string | Date): string {
	const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
	const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

	const steps: [Intl.RelativeTimeFormatUnit, number][] = [
		["year", 31536000],
		["month", 2592000],
		["week", 604800],
		["day", 86400],
		["hour", 3600],
		["minute", 60],
	];

	for (const [unit, size] of steps) {
		if (Math.abs(seconds) >= size) {
			return formatter.format(Math.round(seconds / size), unit);
		}
	}

	return "just now";
}

export type Severity = "ok" | "warn" | "critical";

export function usageSeverity(percent: number | null | undefined): Severity {
	if (percent === null || percent === undefined) return "ok";
	if (percent >= 90) return "critical";
	if (percent >= 70) return "warn";
	return "ok";
}

export function temperatureSeverity(celsius: number | null | undefined): Severity {
	if (celsius === null || celsius === undefined) return "ok";
	if (celsius >= 85) return "critical";
	if (celsius >= 70) return "warn";
	return "ok";
}
