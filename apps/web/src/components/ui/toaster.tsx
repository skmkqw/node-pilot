"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";

type Toast = {
	id: number;
	tone: ToastTone;
	title: string;
	description?: string;
};

type ToastContextValue = {
	toast: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const LED: Record<ToastTone, string> = {
	success: "bg-ok",
	error: "bg-alert animate-blink",
	info: "bg-accent",
};

const LABEL: Record<ToastTone, string> = {
	success: "OK",
	error: "FAULT",
	info: "INFO",
};

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const dismiss = useCallback((id: number) => {
		setToasts((current) => current.filter((toast) => toast.id !== id));
	}, []);

	const toast = useCallback(
		(input: Omit<Toast, "id">) => {
			const id = nextId++;
			setToasts((current) => [...current.slice(-3), { ...input, id }]);
			setTimeout(() => dismiss(id), input.tone === "error" ? 6000 : 3500);
		},
		[dismiss],
	);

	const value = useMemo(() => ({ toast }), [toast]);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-3 px-4 lg:bottom-6 lg:items-end lg:px-6">
				<AnimatePresence initial={false}>
					{toasts.map((item) => (
						<motion.div
							key={item.id}
							layout
							initial={{ opacity: 0, x: 60 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: 60 }}
							transition={{ type: "spring", stiffness: 600, damping: 38 }}
							className="panel-sm pointer-events-auto flex w-full max-w-sm items-start gap-3 p-3"
							role="status"
						>
							<span className={cn("led mt-1", LED[item.tone])} />
							<div className="min-w-0 flex-1">
								<p className="label text-muted">{LABEL[item.tone]}</p>
								<p className="text-sm font-bold text-ink">{item.title}</p>
								{item.description ? <p className="mt-0.5 font-mono text-xs leading-5 text-muted">{item.description}</p> : null}
							</div>
							<button type="button" onClick={() => dismiss(item.id)} className="grid size-7 place-items-center text-ink hover:bg-accent" aria-label="Dismiss notification">
								<X className="size-4" />
							</button>
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</ToastContext.Provider>
	);
}

export function useToast() {
	const context = useContext(ToastContext);

	if (!context) {
		throw new Error("useToast must be used within ToastProvider.");
	}

	return context.toast;
}
