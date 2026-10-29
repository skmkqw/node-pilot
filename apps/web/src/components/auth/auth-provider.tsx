"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UNAUTHORIZED_EVENT } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import type { CurrentUser } from "@/lib/api/types";

/**
 * - `setup`: fresh installation, the administrator account does not exist yet
 * - `anonymous`: account exists, but this browser is not signed in
 */
type AuthState = "loading" | "setup" | "anonymous" | "authenticated" | "offline";

type AuthContextValue = {
	status: AuthState;
	user: CurrentUser | null;
	login: (username: string, password: string, rememberMe: boolean) => Promise<void>;
	setup: (username: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [status, setStatus] = useState<AuthState>("loading");
	const [user, setUser] = useState<CurrentUser | null>(null);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		const controller = new AbortController();

		authApi
			.status(controller.signal)
			.then((current) => {
				if (current.setupRequired) {
					setUser(null);
					setStatus("setup");
				} else if (current.authenticated && current.username) {
					setUser({ username: current.username });
					setStatus("authenticated");
				} else {
					setUser(null);
					setStatus("anonymous");
				}
			})
			.catch((error: unknown) => {
				if (error instanceof DOMException && error.name === "AbortError") return;
				setStatus("offline");
			});

		return () => controller.abort();
	}, [attempt]);

	useEffect(() => {
		// Any API call answered with 401 (e.g. expired session) signs the user out locally.
		const onUnauthorized = () => {
			setUser(null);
			setStatus((current) => (current === "setup" ? current : "anonymous"));
		};

		window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
		return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
	}, []);

	const login = useCallback(async (username: string, password: string, rememberMe: boolean) => {
		const current = await authApi.login(username, password, rememberMe);
		setUser(current);
		setStatus("authenticated");
	}, []);

	const setup = useCallback(async (username: string, password: string) => {
		const current = await authApi.setup(username, password);
		setUser(current);
		setStatus("authenticated");
	}, []);

	const logout = useCallback(async () => {
		try {
			await authApi.logout();
		} finally {
			setUser(null);
			setStatus("anonymous");
		}
	}, []);

	const retry = useCallback(() => {
		setStatus("loading");
		setAttempt((value) => value + 1);
	}, []);

	const value = useMemo(
		() => ({ status, user, login, setup, logout, retry }),
		[status, user, login, setup, logout, retry],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);

	if (!context) {
		throw new Error("useAuth must be used within AuthProvider.");
	}

	return context;
}
