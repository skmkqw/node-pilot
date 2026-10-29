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
			<div className="flex items-center gap-3">
				<span className="grid size-11 place-items-center border-2 border-ink bg-alert text-ink">
					<TriangleAlert className="size-5" />
				</span>
				<span className="label text-muted">Confirm action</span>
			</div>
			<h2 id="confirm-title" className="mt-4 pr-8 text-xl font-bold leading-tight text-ink">
				{title}
			</h2>
			<div className="mt-2 font-mono text-sm leading-6 text-muted">{description}</div>
			<div className="mt-6 flex justify-end gap-3">
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
