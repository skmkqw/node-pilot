export const UNAUTHORIZED_EVENT = "nodepilot:unauthorized";

/**
 * Error carrying the HTTP status and the ProblemDetails title returned by the backend.
 */
export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}

/**
 * Backend base URL. When NEXT_PUBLIC_API_URL is not set, the backend is assumed to run
 * on port 5000 of the same host, which makes the panel work from any device in the LAN.
 */
export function getApiBaseUrl(): string {
	const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

	if (configured) {
		return configured.replace(/\/+$/, "");
	}

	if (typeof window !== "undefined") {
		return `${window.location.protocol}//${window.location.hostname}:5000`;
	}

	return "http://localhost:5000";
}

export function apiUrl(path: string, query?: Record<string, string | number | boolean | undefined>) {
	const url = new URL(`${getApiBaseUrl()}${path}`);

	for (const [key, value] of Object.entries(query ?? {})) {
		if (value !== undefined) {
			url.searchParams.set(key, String(value));
		}
	}

	return url.toString();
}

type RequestOptions = {
	method?: "GET" | "POST" | "DELETE";
	query?: Record<string, string | number | boolean | undefined>;
	body?: unknown;
	signal?: AbortSignal;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const { method = "GET", query, body, signal } = options;

	let response: Response;

	try {
		response = await fetch(apiUrl(path, query), {
			method,
			credentials: "include",
			cache: "no-store",
			signal,
			headers: {
				Accept: "application/json",
				...(body !== undefined ? { "Content-Type": "application/json" } : {}),
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw error;
		}

		throw new ApiError("The NodePilot server is not reachable.", 0);
	}

	if (!response.ok) {
		throw await toApiError(response, path);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

export async function toApiError(response: Response, path: string): Promise<ApiError> {
	if (response.status === 401 && !path.startsWith("/api/auth/login")) {
		window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
	}

	if (response.status === 429) {
		return new ApiError("Too many attempts. Please wait a minute and try again.", 429);
	}

	let message = `Request failed (${response.status}).`;

	try {
		const problem = (await response.json()) as {
			title?: string;
			errors?: Record<string, string[]>;
		};

		const firstValidationError = Object.values(problem.errors ?? {})[0]?.[0];
		message = firstValidationError ?? problem.title ?? message;
	} catch {
		// Body was not ProblemDetails JSON; keep the generic message.
	}

	return new ApiError(message, response.status);
}
