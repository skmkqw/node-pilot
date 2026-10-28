"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { Portal } from "./portal";

type ModalProps = {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	className?: string;
	labelledBy?: string;
};

export function Modal({ open, onClose, children, className, labelledBy }: ModalProps) {
	useEffect(() => {
		if (!open) return;

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		window.addEventListener("keydown", onKeyDown);

		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [open, onClose]);

	return (
		<Portal>
			<AnimatePresence>
				{open ? (
					<motion.div
						className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-8"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
					>
						<div className="absolute inset-0 bg-ink/70" onClick={onClose} aria-hidden />
						<motion.div
							role="dialog"
							aria-modal="true"
							aria-labelledby={labelledBy}
							initial={{ opacity: 0, y: 28 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 16 }}
							transition={{ type: "spring", stiffness: 520, damping: 34 }}
							className={cn("panel relative w-full shadow-[8px_8px_0_var(--accent)]", className)}
						>
							<button
								type="button"
								onClick={onClose}
								aria-label="Close"
								className="absolute right-3 top-3 z-10 grid size-9 place-items-center border-2 border-ink bg-surface text-ink transition hover:bg-accent"
							>
								<X className="size-4" />
							</button>
							{children}
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</Portal>
	);
}
