"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "./button";
import { Modal } from "./modal";

type ConfirmDialogProps = {
	open: boolean;
	title: string;
	description: React.ReactNode;
	confirmLabel: string;
	isPending?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
};

export function ConfirmDialog({ open, title, description, confirmLabel, isPending, onConfirm, onCancel }: ConfirmDialogProps) {
	return (
		<Modal open={open} onClose={onCancel} className="max-w-md p-6" labelledBy="confirm-title">
			<div className="grid size-12 place-items-center rounded-2xl border border-rose-300/20 bg-rose-500/10 text-rose-300 shadow-[0_0_30px_-8px_rgba(244,63,94,0.8)]">
				<TriangleAlert className="size-5" />
			</div>
			<h2 id="confirm-title" className="mt-4 text-lg font-semibold text-white">
				{title}
			</h2>
			<div className="mt-1.5 text-sm leading-6 text-muted">{description}</div>
			<div className="mt-6 flex justify-end gap-2">
				<Button variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
				<Button variant="danger" onClick={onConfirm} isLoading={isPending}>
					{confirmLabel}
				</Button>
			</div>
		</Modal>
	);
}
