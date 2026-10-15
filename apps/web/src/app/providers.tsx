"use client";

import { MotionConfig } from "motion/react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ToastProvider } from "@/components/ui/toaster";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<MotionConfig reducedMotion="user">
			<AuthProvider>
				<ToastProvider>{children}</ToastProvider>
			</AuthProvider>
		</MotionConfig>
	);
}
