"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClassName } from "@/components/ui/field";
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
			<p className="label text-muted">New directory</p>
			<h2 id="new-folder-title" className="mt-1 pr-10 text-xl font-bold uppercase">
				Create folder
			</h2>
			<div className="mt-5">
				<Field icon={<FolderPlus className="size-4" />} label="Folder name">
					<input
						autoFocus
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="e.g. Movies"
						maxLength={255}
						className={inputClassName}
					/>
				</Field>
			</div>
			<div className="mt-6 flex justify-end gap-3">
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
