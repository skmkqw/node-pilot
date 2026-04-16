import { SystemStatusDto } from "@/types/system-status";

const BACKEND_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export async function getSystemStatus(
    signal?: AbortSignal
): Promise<SystemStatusDto> {
    const response = await fetch(`${BACKEND_URL}/api/system/status`, {
        method: "GET",
        headers: {
            Accept: "application/json",
        },
        cache: "no-store",
        signal,
    });

    if (!response.ok) {
        throw new Error(`Status request failed: ${response.status}`);
    }

    const data = (await response.json()) as SystemStatusDto;

    validateSystemStatus(data);

    return data;
}

function validateSystemStatus(data: SystemStatusDto) {
    if (
        typeof data.cpuUsagePercent !== "number" ||
        typeof data.ramUsagePercent !== "number" ||
        typeof data.totalMemoryBytes !== "number" ||
        typeof data.usedMemoryBytes !== "number" ||
        typeof data.availableMemoryBytes !== "number" ||
        typeof data.collectedAtUtc !== "string"
    ) {
        throw new Error("Invalid status payload received from backend.");
    }
}