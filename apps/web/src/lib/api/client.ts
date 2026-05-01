import { SystemMetricDto } from "@/types/system-metric";

const DEFAULT_API_BASE_URL = "http://localhost:5000";

function getApiBaseUrl() {
    const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    const baseUrl = configuredUrl?.length
        ? configuredUrl
        : DEFAULT_API_BASE_URL;

    return baseUrl.replace(/\/+$/, "");
}

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        method: "GET",
        headers: {
            Accept: "application/json",
        },
        cache: "no-store",
        signal,
    });

    if (!response.ok) {
        throw new Error(`Request failed for ${path}: ${response.status}`);
    }

    return (await response.json()) as T;
}

export async function getSystemStatus(
    signal?: AbortSignal
): Promise<SystemMetricDto> {
    const data = await requestJson<SystemMetricDto>(
        "/api/system/metrics/current",
        signal
    );

    validateSystemMetrics(data);

    return data;
}

type HistoricalMetricsParams = {
    start: string;
    end: string;
    minIntervalSeconds?: number;
};

export async function getHistoricalSystemMetrics(
    { start, end, minIntervalSeconds }: HistoricalMetricsParams,
    signal?: AbortSignal
): Promise<SystemMetricDto[]> {
    const searchParams = new URLSearchParams({ start, end });

    if (typeof minIntervalSeconds === "number") {
        searchParams.set("minIntervalSeconds", minIntervalSeconds.toString());
    }

    const data = await requestJson<SystemMetricDto[]>(
        `/api/system/metrics/historical?${searchParams.toString()}`,
        signal
    );

    validateHistoricalMetrics(data);

    return data;
}

function validateSystemMetrics(data: SystemMetricDto) {
    if (
        typeof data.id !== "number" ||
        typeof data.cpuUsagePercent !== "number" ||
        typeof data.ramUsagePercent !== "number" ||
        (data.status !== 0 && data.status !== 1) ||
        (data.failureReason !== null && typeof data.failureReason !== "string") ||
        typeof data.collectedAtUtc !== "string"
    ) {
        throw new Error("Invalid metrics payload received from backend.");
    }
}

function validateHistoricalMetrics(data: SystemMetricDto[]) {
    if (!Array.isArray(data)) {
        throw new Error("Invalid historical metrics payload received from backend.");
    }

    for (const item of data) {
        validateSystemMetrics(item)
    }
}
