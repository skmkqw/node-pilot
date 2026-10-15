"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type NewFolderDialogProps = {
	open: boolean;
	onClose: () => void;
	onCreate: (name: string) => Promise<void>;
};

export function NewFolderDialog({ open, onClose, onCreate }: NewFolderDialogProps) {
	return (
		<Modal open={open} onClose={onClose} className="max-w-md p-6" labelledBy="new-folder-title">
			{/* Remount the form each time so the input starts empty. */}
			{open ? <NewFolderForm onClose={onClose} onCreate={onCreate} /> : null}
		</Modal>
	);
}

function NewFolderForm({ onClose, onCreate }: Omit<NewFolderDialogProps, "open">) {
	const [name, setName] = useState("");
	const [isPending, setIsPending] = useState(false);

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		setIsPending(true);

		try {
			await onCreate(name.trim());
			onClose();
		} finally {
			setIsPending(false);
		}
	};

	return (
		<form onSubmit={submit}>
			<div className="grid size-12 place-items-center rounded-2xl border border-sky-300/20 bg-sky-400/10 text-sky-300 shadow-[0_0_30px_-8px_rgba(56,189,248,0.8)]">
				<FolderPlus className="size-5" />
			</div>
			<h2 id="new-folder-title" className="mt-4 text-lg font-semibold text-white">
				New folder
			</h2>
			<input
				autoFocus
				value={name}
				onChange={(event) => setName(event.target.value)}
				placeholder="e.g. Movies"
				maxLength={255}
				className="mt-4 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
			/>
			<div className="mt-6 flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={onClose}>
					Cancel
				</Button>
				<Button type="submit" variant="primary" disabled={!name.trim()} isLoading={isPending}>
					Create
				</Button>
			</div>
		</form>
	);
}
