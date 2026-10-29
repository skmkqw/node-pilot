"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Download, Eye, FolderPlus, HardDrive, Play, Search, Trash2, TriangleAlert, Upload, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Portal } from "@/components/ui/portal";
import { useToast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { filesApi } from "@/lib/api/endpoints";
import type { FileEntry } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatBytes, formatRelative } from "@/lib/format";
import { usePolling } from "@/lib/use-polling";
import { FileIcon } from "./file-icon";
import { MediaViewer } from "./media-viewer";
import { NewFolderDialog } from "./new-folder-dialog";
import { UploadQueue, type UploadItem } from "./upload-queue";

let uploadId = 1;

function isViewable(entry: FileEntry) {
	return entry.isPlayable || entry.kind === "Image";
}

function hrefFor(path: string) {
	return path === "/" ? "/files" : `/files?path=${encodeURIComponent(path)}`;
}

export function FileBrowser({ path }: { path: string }) {
	const router = useRouter();
	const toast = useToast();
	const listing = usePolling((signal) => filesApi.list(path, signal), 30_000, [path]);

	const [query, setQuery] = useState("");
	const [viewerIndex, setViewerIndex] = useState<number | null>(null);
	const [pendingDelete, setPendingDelete] = useState<FileEntry | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [showNewFolder, setShowNewFolder] = useState(false);
	const [uploads, setUploads] = useState<UploadItem[]>([]);
	const [isDragging, setIsDragging] = useState(false);
	const dragDepth = useRef(0);
	const fileInput = useRef<HTMLInputElement>(null);

	const entries = useMemo(() => {
		const all = listing.data?.entries ?? [];
		const needle = query.trim().toLowerCase();
		return needle ? all.filter((entry) => entry.name.toLowerCase().includes(needle)) : all;
	}, [listing.data, query]);

	const viewable = useMemo(() => entries.filter(isViewable), [entries]);

	const crumbs = useMemo(() => {
		const parts = path.split("/").filter(Boolean);
		return parts.map((part, index) => ({ name: part, path: "/" + parts.slice(0, index + 1).join("/") }));
	}, [path]);

	const updateUpload = useCallback((id: number, patch: Partial<UploadItem>) => {
		setUploads((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
	}, []);

	const dismissUpload = useCallback((id: number) => {
		setUploads((current) => current.filter((item) => item.id !== id));
	}, []);

	const startUploads = useCallback(
		(files: FileList | File[]) => {
			for (const file of Array.from(files)) {
				const id = uploadId++;
				const { promise, abort } = filesApi.upload(path, file, (progress) => updateUpload(id, { progress }));

				setUploads((current) => [...current, { id, name: file.name, size: file.size, progress: 0, status: "uploading", abort }]);

				promise
					.then(() => {
						updateUpload(id, { status: "done", progress: 1 });
						listing.refresh();
						setTimeout(() => dismissUpload(id), 2500);
					})
					.catch((error: unknown) => {
						if (error instanceof DOMException && error.name === "AbortError") {
							dismissUpload(id);
							return;
						}
						updateUpload(id, { status: "error", error: (error as Error).message });
					});
			}
		},
		[path, updateUpload, dismissUpload, listing],
	);

	const open = (entry: FileEntry) => {
		if (entry.kind === "Directory") {
			router.push(hrefFor(entry.path));
		} else if (isViewable(entry)) {
			setViewerIndex(viewable.indexOf(entry));
		} else {
			window.location.assign(filesApi.contentUrl(entry.path, true));
		}
	};

	const confirmDelete = async () => {
		if (!pendingDelete) return;
		setIsDeleting(true);

		try {
			await filesApi.remove(pendingDelete.path);
			if (listing.data) {
				listing.setData({
					...listing.data,
					entries: listing.data.entries.filter((entry) => entry.path !== pendingDelete.path),
				});
			}
			toast({ tone: "success", title: `Deleted “${pendingDelete.name}”` });
			setPendingDelete(null);
			listing.refresh();
		} catch (error) {
			toast({ tone: "error", title: "Delete failed", description: (error as Error).message });
		} finally {
			setIsDeleting(false);
		}
	};

	const createFolder = async (name: string) => {
		try {
			await filesApi.createDirectory(path, name);
			toast({ tone: "success", title: `Folder “${name}” created` });
			listing.refresh();
		} catch (error) {
			toast({ tone: "error", title: "Could not create folder", description: (error as Error).message });
			throw error;
		}
	};

	const dragHandlers = {
		onDragEnter: (event: React.DragEvent) => {
			if (!event.dataTransfer.types.includes("Files")) return;
			event.preventDefault();
			dragDepth.current += 1;
			setIsDragging(true);
		},
		onDragOver: (event: React.DragEvent) => {
			if (event.dataTransfer.types.includes("Files")) event.preventDefault();
		},
		onDragLeave: () => {
			dragDepth.current = Math.max(0, dragDepth.current - 1);
			if (dragDepth.current === 0) setIsDragging(false);
		},
		onDrop: (event: React.DragEvent) => {
			event.preventDefault();
			dragDepth.current = 0;
			setIsDragging(false);
			if (event.dataTransfer.files.length) startUploads(event.dataTransfer.files);
		},
	};

	const notFound = listing.error instanceof ApiError && (listing.error.status === 404 || listing.error.status === 400);
	const data = listing.data;

	return (
		<div {...dragHandlers} className="relative">
			<PageHeader
				eyebrow={
					<span className="inline-flex items-center gap-1.5">
						<HardDrive className="size-3.5" /> CH-H / Server storage
					</span>
				}
				title="Files & Media"
				description="Browse your server, stream videos in the browser, and drop files anywhere to upload."
				actions={
					<>
						<Button onClick={() => setShowNewFolder(true)}>
							<FolderPlus className="size-4" /> New folder
						</Button>
						<Button variant="primary" onClick={() => fileInput.current?.click()}>
							<Upload className="size-4" /> Upload
						</Button>
						<input
							ref={fileInput}
							type="file"
							multiple
							hidden
							onChange={(event) => {
								if (event.target.files?.length) startUploads(event.target.files);
								event.target.value = "";
							}}
						/>
					</>
				}
			/>

			<Card>
				{/* Toolbar: breadcrumbs + search */}
				<div className="flex flex-col gap-3 border-b-2 border-ink bg-accent p-3 sm:flex-row sm:items-center sm:justify-between">
					<nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-sm font-bold">
						<Link href="/files" className="border-2 border-transparent px-2 py-1 uppercase hover:border-ink hover:bg-surface">
							Storage
						</Link>
						<AnimatePresence initial={false}>
							{crumbs.map((crumb, index) => (
								<motion.span
									key={crumb.path}
									layout
									initial={{ opacity: 0, x: -8 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -8 }}
									className="flex items-center gap-1"
								>
									<ChevronRight className="size-4" />
									<Link
										href={hrefFor(crumb.path)}
										className={cn(
											"max-w-[12rem] truncate border-2 px-2 py-1",
											index === crumbs.length - 1 ? "border-ink bg-ink text-accent" : "border-transparent hover:border-ink hover:bg-surface",
										)}
									>
										{crumb.name}
									</Link>
								</motion.span>
							))}
						</AnimatePresence>
					</nav>

					<label className="flex h-10 items-center gap-2 border-2 border-ink bg-surface px-3 sm:w-64">
						<Search className="size-4 shrink-0" />
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="FILTER THIS FOLDER"
							aria-label="Filter this folder"
							className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-muted/80"
						/>
					</label>
				</div>

				{data ? (
					<div className="label flex flex-wrap gap-x-5 gap-y-1 border-b-2 border-ink px-4 py-2 text-muted">
						<span>{data.directoryCount} folders</span>
						<span>{data.fileCount} files</span>
						<span>{formatBytes(data.totalSizeBytes)}</span>
					</div>
				) : null}

				<div>
					{listing.isLoading && !data ? (
						<div className="space-y-2 p-3">
							{Array.from({ length: 6 }).map((_, index) => (
								<div key={index} className="skeleton h-14" />
							))}
						</div>
					) : notFound ? (
						<EmptyState
							icon={<TriangleAlert className="size-7" />}
							title="This folder does not exist"
							text="It may have been moved or deleted."
							action={
								<Link href="/files" className={buttonStyles("secondary", "md")}>
									Back to storage
								</Link>
							}
						/>
					) : entries.length === 0 ? (
						<EmptyState
							icon={<UploadCloud className="size-7" />}
							title={query ? "Nothing matches your filter" : "This folder is empty"}
							text={query ? "Try a different name." : "Drag & drop files here, or use the Upload button."}
							action={
								!query ? (
									<Button variant="primary" onClick={() => fileInput.current?.click()}>
										<Upload className="size-4" /> Upload files
									</Button>
								) : null
							}
						/>
					) : (
						<ul>
							<AnimatePresence initial={false}>
								{entries.map((entry, index) => (
									<motion.li
										key={entry.path}
										layout
										initial={{ opacity: 0, x: -12 }}
										animate={{ opacity: 1, x: 0, transition: { delay: Math.min(index * 0.03, 0.4), type: "spring", stiffness: 500, damping: 36 } }}
										exit={{ opacity: 0, x: 40, height: 0, transition: { duration: 0.2 } }}
										className="group border-b-2 border-ink/15 last:border-b-0"
									>
										<div className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-ground/70 sm:px-4">
											<button
												type="button"
												onClick={() => open(entry)}
												className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
											>
												<FileIcon kind={entry.kind} />
												<span className="min-w-0">
													<span className="block truncate text-sm font-bold">{entry.name}</span>
													<span className="block font-mono text-xs text-muted sm:hidden">
														{entry.kind === "Directory" ? "FOLDER" : formatBytes(entry.sizeBytes)} · {formatRelative(entry.modifiedAtUtc)}
													</span>
												</span>
												{entry.isPlayable ? <span className="label hidden border-2 border-ink bg-accent px-1.5 py-0.5 md:inline">Play</span> : null}
											</button>

											<span className="hidden w-24 text-right font-mono text-xs tabular sm:block">
												{entry.kind === "Directory" ? "—" : formatBytes(entry.sizeBytes)}
											</span>
											<span className="hidden w-32 text-right font-mono text-xs text-muted md:block">{formatRelative(entry.modifiedAtUtc)}</span>

											<div className="flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
												{entry.isPlayable ? (
													<IconAction label="Play" onClick={() => open(entry)}>
														<Play className="size-4 fill-current" />
													</IconAction>
												) : entry.kind === "Image" ? (
													<IconAction label="Preview" onClick={() => open(entry)}>
														<Eye className="size-4" />
													</IconAction>
												) : null}
												{entry.kind !== "Directory" ? (
													<a
														href={filesApi.contentUrl(entry.path, true)}
														download
														aria-label={`Download ${entry.name}`}
														className="grid size-9 place-items-center border-2 border-transparent hover:border-ink hover:bg-surface"
													>
														<Download className="size-4" />
													</a>
												) : null}
												<IconAction label={`Delete ${entry.name}`} onClick={() => setPendingDelete(entry)} danger>
													<Trash2 className="size-4" />
												</IconAction>
											</div>
										</div>
									</motion.li>
								))}
							</AnimatePresence>
						</ul>
					)}
				</div>
			</Card>

			{/* Drop overlay */}
			<Portal>
				<AnimatePresence>
					{isDragging ? (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-ink/70 p-6"
						>
							<motion.div
								initial={{ y: 20 }}
								animate={{ y: 0 }}
								className="flex w-full max-w-lg flex-col items-center border-4 border-dashed border-ink bg-accent px-8 py-14 text-center shadow-[10px_10px_0_var(--ink)]"
							>
								<motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}>
									<UploadCloud className="size-12" />
								</motion.div>
								<p className="mt-4 text-2xl font-bold uppercase">Drop to upload</p>
								<p className="label mt-1">Saving to {path === "/" ? "storage" : path}</p>
							</motion.div>
						</motion.div>
					) : null}
				</AnimatePresence>
			</Portal>

			<MediaViewer items={viewable} index={viewerIndex} onIndexChange={setViewerIndex} />

			<ConfirmDialog
				open={pendingDelete !== null}
				title={`Delete “${pendingDelete?.name ?? ""}”?`}
				description={
					pendingDelete?.kind === "Directory"
						? "The folder and everything inside it will be permanently removed from the server."
						: "The file will be permanently removed from the server."
				}
				confirmLabel="Delete"
				isPending={isDeleting}
				onConfirm={() => void confirmDelete()}
				onCancel={() => setPendingDelete(null)}
			/>

			<NewFolderDialog open={showNewFolder} onClose={() => setShowNewFolder(false)} onCreate={createFolder} />

			<UploadQueue items={uploads} onDismiss={dismissUpload} />
		</div>
	);
}

function IconAction({
	label,
	onClick,
	danger,
	children,
}: {
	label: string;
	onClick: () => void;
	danger?: boolean;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
			className={cn("grid size-9 place-items-center border-2 border-transparent hover:border-ink", danger ? "hover:bg-alert" : "hover:bg-accent")}
		>
			{children}
		</button>
	);
}

function EmptyState({
	icon,
	title,
	text,
	action,
}: {
	icon: React.ReactNode;
	title: string;
	text: string;
	action?: React.ReactNode;
}) {
	return (
		<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center px-6 py-16 text-center">
			<motion.div
				animate={{ y: [0, -6, 0] }}
				transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
				className="grid size-16 place-items-center border-2 border-ink bg-accent shadow-[5px_5px_0_var(--ink)]"
			>
				{icon}
			</motion.div>
			<p className="mt-6 text-lg font-bold uppercase">{title}</p>
			<p className="mt-1 font-mono text-sm text-muted">{text}</p>
			{action ? <div className="mt-5">{action}</div> : null}
		</motion.div>
	);
}
