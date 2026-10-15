"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

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
		<AnimatePresence>
			{open ? (
				<motion.div
					className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-8"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
				>
					<motion.div
						className="absolute inset-0 bg-[#02040a]/75 backdrop-blur-md"
						onClick={onClose}
						aria-hidden
					/>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby={labelledBy}
						initial={{ opacity: 0, scale: 0.94, y: 24, filter: "blur(8px)" }}
						animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
						exit={{ opacity: 0, scale: 0.96, y: 12, filter: "blur(6px)" }}
						transition={{ type: "spring", stiffness: 360, damping: 30 }}
						className={cn("glass relative w-full rounded-3xl", className)}
					>
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full border border-white/10 bg-black/40 text-slate-300 backdrop-blur transition hover:rotate-90 hover:text-white"
						>
							<X className="size-4" />
						</button>
						{children}
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
