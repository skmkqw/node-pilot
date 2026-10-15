"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

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

const toneStyles: Record<ToastTone, { icon: React.ReactNode; ring: string }> = {
	success: { icon: <CircleCheck className="size-5 text-emerald-300" />, ring: "border-emerald-300/20" },
	error: { icon: <TriangleAlert className="size-5 text-rose-300" />, ring: "border-rose-300/25" },
	info: { icon: <Info className="size-5 text-sky-300" />, ring: "border-sky-300/20" },
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
			<div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6">
				<AnimatePresence initial={false}>
					{toasts.map((item) => (
						<motion.div
							key={item.id}
							layout
							initial={{ opacity: 0, y: 24, scale: 0.92, filter: "blur(6px)" }}
							animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
							exit={{ opacity: 0, x: 40, scale: 0.95, filter: "blur(6px)" }}
							transition={{ type: "spring", stiffness: 420, damping: 32 }}
							className={`glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 ${toneStyles[item.tone].ring}`}
							role="status"
						>
							{toneStyles[item.tone].icon}
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-white">{item.title}</p>
								{item.description ? (
									<p className="mt-0.5 text-xs leading-5 text-muted">{item.description}</p>
								) : null}
							</div>
							<button
								type="button"
								onClick={() => dismiss(item.id)}
								className="text-slate-500 transition hover:text-white"
								aria-label="Dismiss notification"
							>
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
