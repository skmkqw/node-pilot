import { SystemStatusDto } from "@/types/system-status";

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
): Promise<SystemStatusDto> {
    const data = await requestJson<SystemStatusDto>("/api/system/metrics/current", signal);

    validateSystemStatus(data);

    return data;
}

function validateSystemStatus(data: SystemStatusDto) {
    if (
        typeof data.cpuUsagePercent !== "number" ||
        typeof data.ramUsagePercent !== "number" ||
        typeof data.status !== "number" ||
        (data.failureReason !== null && typeof data.failureReason !== "string") ||
        typeof data.collectedAtUtc !== "string"
    ) {
        throw new Error("Invalid status payload received from backend.");
    }
}
