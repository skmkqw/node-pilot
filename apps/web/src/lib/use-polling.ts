"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PollingState<T> = {
	data: T | null;
	error: Error | null;
	isLoading: boolean;
	refresh: () => void;
	setData: (data: T) => void;
};

/**
 * Fetches immediately, then every `intervalMs`. Pauses while the tab is hidden and
 * refreshes as soon as it becomes visible again. Keeps the last good data on errors.
 */
export function usePolling<T>(
	fetcher: (signal: AbortSignal) => Promise<T>,
	intervalMs: number,
	deps: React.DependencyList = [],
): PollingState<T> {
	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<Error | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [tick, setTick] = useState(0);

	const fetcherRef = useRef(fetcher);
	fetcherRef.current = fetcher;

	const refresh = useCallback(() => setTick((value) => value + 1), []);

	useEffect(() => {
		setIsLoading(true);
		setData(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps);

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
				setData(result);
				setError(null);
			} catch (caught) {
				if (!active || (caught instanceof DOMException && caught.name === "AbortError")) {
					return;
				}
				setError(caught instanceof Error ? caught : new Error(String(caught)));
			} finally {
				if (active) {
					setIsLoading(false);
					if (!document.hidden) {
						timer = setTimeout(run, intervalMs);
					}
				}
			}
		};

		const onVisibilityChange = () => {
			if (!document.hidden) {
				clearTimeout(timer);
				void run();
			} else {
				clearTimeout(timer);
			}
		};

		void run();
		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			active = false;
			clearTimeout(timer);
			controller?.abort();
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [intervalMs, tick, ...deps]);

	return { data, error, isLoading, refresh, setData };
}
