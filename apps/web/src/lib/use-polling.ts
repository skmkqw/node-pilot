"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PollingState<T> = {
	data: T | null;
	error: Error | null;
	isLoading: boolean;
	refresh: () => void;
	setData: (data: T) => void;
};

type Snapshot<T> = {
	key: string;
	data: T | null;
	error: Error | null;
	settled: boolean;
};

/**
 * Fetches immediately, then every `intervalMs`. Pauses while the tab is hidden and
 * refreshes as soon as it becomes visible again. Keeps the last good data on errors.
 * Changing `deps` starts over with empty data (e.g. when opening another folder).
 */
export function usePolling<T>(
	fetcher: (signal: AbortSignal) => Promise<T>,
	intervalMs: number,
	deps: React.DependencyList = [],
): PollingState<T> {
	const key = JSON.stringify(deps);
	const [snapshot, setSnapshot] = useState<Snapshot<T>>({ key, data: null, error: null, settled: false });
	const [tick, setTick] = useState(0);
	const fetcherRef = useRef(fetcher);

	useEffect(() => {
		fetcherRef.current = fetcher;
	});

	const refresh = useCallback(() => setTick((value) => value + 1), []);

	const setData = useCallback(
		(data: T) => setSnapshot((current) => ({ ...current, data })),
		[],
	);

	useEffect(() => {
		let active = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let controller: AbortController | undefined;

		const run = async () => {
			controller?.abort();
			controller = new AbortController();

			try {
				const result = await fetcherRef.current(controller.signal);
				if (!active) return;
				setSnapshot({ key, data: result, error: null, settled: true });
			} catch (caught) {
				if (!active || (caught instanceof DOMException && caught.name === "AbortError")) {
					return;
				}
				const error = caught instanceof Error ? caught : new Error(String(caught));
				setSnapshot((current) => ({
					key,
					data: current.key === key ? current.data : null,
					error,
					settled: true,
				}));
			} finally {
				if (active && !document.hidden) {
					timer = setTimeout(run, intervalMs);
				}
			}
		};

		const onVisibilityChange = () => {
			clearTimeout(timer);
			if (!document.hidden) void run();
		};

		void run();
		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			active = false;
			clearTimeout(timer);
			controller?.abort();
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [intervalMs, tick, key]);

	const fresh = snapshot.key === key;

	return {
		data: fresh ? snapshot.data : null,
		error: fresh ? snapshot.error : null,
		isLoading: !fresh || !snapshot.settled,
		refresh,
		setData,
	};
}
