"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/shell/app-shell";
import { Splash } from "@/components/shell/splash";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
	const { status } = useAuth();
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		if (status === "anonymous") {
			router.replace(`/login?next=${encodeURIComponent(pathname)}`);
		}
	}, [status, router, pathname]);

	if (status !== "authenticated") {
		return <Splash />;
	}

	return <AppShell>{children}</AppShell>;
}
