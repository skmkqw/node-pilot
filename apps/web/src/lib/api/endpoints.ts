import { ApiError, apiUrl, request, toApiError } from "./client";
import type {
	AdBlockerStatus,
	CurrentUser,
	DirectoryListing,
	FileEntry,
	IntervalMetricsSummary,
	SystemMetric,
	SystemOverview,
} from "./types";

export const authApi = {
	me: (signal?: AbortSignal) => request<CurrentUser>("/api/auth/me", { signal }),

	login: (username: string, password: string, rememberMe: boolean) =>
		request<CurrentUser>("/api/auth/login", {
			method: "POST",
			body: { username, password, rememberMe },
		}),

	logout: () => request<void>("/api/auth/logout", { method: "POST" }),
};

export const systemApi = {
	current: (signal?: AbortSignal) =>
		request<SystemMetric>("/api/system/metrics/current", { signal }),

	overview: (signal?: AbortSignal) =>
		request<SystemOverview>("/api/system/overview", { signal }),

	historical: (
		params: { start: Date; end: Date; intervalSeconds: number },
		signal?: AbortSignal,
	) =>
		request<IntervalMetricsSummary[]>("/api/system/metrics/historical", {
			signal,
			query: {
				start: params.start.toISOString(),
				end: params.end.toISOString(),
				minIntervalSeconds: params.intervalSeconds,
			},
		}),
};

export const filesApi = {
	list: (path: string, signal?: AbortSignal) =>
		request<DirectoryListing>("/api/files", { query: { path }, signal }),

	createDirectory: (path: string, name: string) =>
		request<FileEntry>("/api/files/directories", {
			method: "POST",
			body: { path, name },
		}),

	remove: (path: string) =>
		request<void>("/api/files", { method: "DELETE", query: { path } }),

	contentUrl: (path: string, download = false) =>
		apiUrl("/api/files/content", { path, download: download || undefined }),

	/**
	 * Uses XMLHttpRequest because fetch() cannot report upload progress.
	 */
	upload: (
		directory: string,
		file: File,
		onProgress: (fraction: number) => void,
	): { promise: Promise<FileEntry[]>; abort: () => void } => {
		const xhr = new XMLHttpRequest();

		const promise = new Promise<FileEntry[]>((resolve, reject) => {
			xhr.open("POST", apiUrl("/api/files/upload", { path: directory }));
			xhr.withCredentials = true;
			xhr.setRequestHeader("Accept", "application/json");

			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable) {
					onProgress(event.loaded / event.total);
				}
			};

			xhr.onload = async () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					resolve(JSON.parse(xhr.responseText) as FileEntry[]);
					return;
				}

				const response = new Response(xhr.responseText || null, { status: xhr.status });
				reject(await toApiError(response, "/api/files/upload"));
			};

			xhr.onerror = () => reject(new ApiError("Upload failed: server not reachable.", 0));
			xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

			const form = new FormData();
			form.append("files", file, file.name);
			xhr.send(form);
		});

		return { promise, abort: () => xhr.abort() };
	},
};

export const adBlockApi = {
	status: (signal?: AbortSignal) => request<AdBlockerStatus>("/api/adblock", { signal }),

	setBlocking: (enabled: boolean, durationSeconds?: number) =>
		request<AdBlockerStatus>("/api/adblock/blocking", {
			method: "POST",
			body: { enabled, durationSeconds: durationSeconds ?? null },
		}),
};
