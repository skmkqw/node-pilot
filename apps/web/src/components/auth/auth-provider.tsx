"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UNAUTHORIZED_EVENT } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import type { CurrentUser } from "@/lib/api/types";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
	status: AuthStatus;
	user: CurrentUser | null;
	login: (username: string, password: string, rememberMe: boolean) => Promise<void>;
	logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [status, setStatus] = useState<AuthStatus>("loading");
	const [user, setUser] = useState<CurrentUser | null>(null);

	useEffect(() => {
		const controller = new AbortController();

		authApi
			.me(controller.signal)
			.then((current) => {
				setUser(current);
				setStatus("authenticated");
			})
			.catch((error: unknown) => {
				if (error instanceof DOMException && error.name === "AbortError") return;
				setUser(null);
				setStatus("anonymous");
			});

		// Any API call answered with 401 (e.g. expired session) signs the user out locally.
		const onUnauthorized = () => {
			setUser(null);
			setStatus("anonymous");
		};

		window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);

		return () => {
			controller.abort();
			window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
		};
	}, []);

	const login = useCallback(async (username: string, password: string, rememberMe: boolean) => {
		const current = await authApi.login(username, password, rememberMe);
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

	const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);

	if (!context) {
		throw new Error("useAuth must be used within AuthProvider.");
	}

	return context;
}
