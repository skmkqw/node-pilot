"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Download, Eye, FolderPlus, HardDrive, Play, Search, Trash2, TriangleAlert, Upload, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Portal } from "@/components/ui/portal";
import { useToast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { filesApi } from "@/lib/api/endpoints";
import type { FileEntry } from "@/lib/api/types";
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
						<HardDrive className="size-3.5" /> Server storage
					</span>
				}
				title="Files & Media"
				description="Browse your server, stream videos right in the browser, and drop files to upload."
				actions={
					<>
						<Button variant="secondary" onClick={() => setShowNewFolder(true)}>
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

			<Card glow="#38bdf8" className="p-2 sm:p-3">
				{/* Toolbar: breadcrumbs + search */}
				<div className="flex flex-col gap-3 p-2 sm:flex-row sm:items-center sm:justify-between">
					<nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
						<Link
							href="/files"
							className="rounded-lg px-2 py-1 font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
						>
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
									<ChevronRight className="size-3.5 text-slate-600" />
									<Link
										href={hrefFor(crumb.path)}
										className={`max-w-[12rem] truncate rounded-lg px-2 py-1 transition hover:bg-white/5 ${index === crumbs.length - 1 ? "font-medium text-white" : "text-slate-400 hover:text-white"}`}
									>
										{crumb.name}
									</Link>
								</motion.span>
							))}
						</AnimatePresence>
					</nav>

					<label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-slate-500 transition focus-within:border-cyan-300/40 focus-within:text-cyan-300 sm:w-64">
						<Search className="size-4" />
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Filter this folder"
							className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
						/>
					</label>
				</div>

				{data ? (
					<div className="flex gap-4 px-4 pb-2 pt-1 text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
						<span>{data.directoryCount} folders</span>
						<span>{data.fileCount} files</span>
						<span>{formatBytes(data.totalSizeBytes)}</span>
					</div>
				) : null}

				<div className="mt-1 border-t border-white/5">
					{listing.isLoading && !data ? (
						<div className="space-y-2 p-3">
							{Array.from({ length: 6 }).map((_, index) => (
								<div key={index} className="skeleton h-14 rounded-2xl" style={{ opacity: 1 - index * 0.13 }} />
							))}
						</div>
					) : notFound ? (
						<EmptyState
							icon={<TriangleAlert className="size-7" />}
							title="This folder does not exist"
							text="It may have been moved or deleted."
							action={
								<Link href="/files">
									<Button variant="secondary">Back to storage</Button>
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
						<ul className="divide-y divide-white/[0.04] p-1">
							<AnimatePresence initial={false}>
								{entries.map((entry, index) => (
									<motion.li
										key={entry.path}
										layout
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.025, 0.4) } }}
										exit={{ opacity: 0, x: -24, height: 0, transition: { duration: 0.25 } }}
										className="group"
									>
										<div className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/[0.04] sm:px-3">
											<button
												type="button"
												onClick={() => open(entry)}
												className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
											>
												<motion.span whileHover={{ scale: 1.08, rotate: -3 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
													<FileIcon kind={entry.kind} />
												</motion.span>
												<span className="min-w-0">
													<span className="block truncate text-sm font-medium text-slate-100 group-hover:text-white">
														{entry.name}
													</span>
													<span className="block text-xs text-slate-500 sm:hidden">
														{entry.kind === "Directory" ? "Folder" : formatBytes(entry.sizeBytes)} · {formatRelative(entry.modifiedAtUtc)}
													</span>
												</span>
												{entry.isPlayable ? (
													<span className="hidden rounded-full border border-pink-300/20 bg-pink-400/10 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-pink-200 md:inline">
														Playable
													</span>
												) : null}
											</button>

											<span className="hidden w-24 text-right text-xs text-slate-400 tabular sm:block">
												{entry.kind === "Directory" ? "—" : formatBytes(entry.sizeBytes)}
											</span>
											<span className="hidden w-32 text-right text-xs text-slate-500 md:block">
												{formatRelative(entry.modifiedAtUtc)}
											</span>

											<div className="flex items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
												{entry.isPlayable ? (
													<IconAction label="Play" onClick={() => open(entry)} className="text-pink-300">
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
														className="grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white"
													>
														<Download className="size-4" />
													</a>
												) : null}
												<IconAction label={`Delete ${entry.name}`} onClick={() => setPendingDelete(entry)} className="hover:text-rose-300">
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
							className="pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-[#02040a]/70 p-6 backdrop-blur-sm"
						>
							<motion.div
								initial={{ scale: 0.9 }}
								animate={{ scale: 1 }}
								className="flex w-full max-w-lg flex-col items-center rounded-[2rem] border-2 border-dashed border-cyan-300/50 bg-cyan-400/5 px-8 py-14 text-center shadow-[0_0_80px_-20px_rgba(34,211,238,0.6)]"
							>
								<motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
									<UploadCloud className="size-12 text-cyan-300" />
								</motion.div>
								<p className="mt-4 text-lg font-semibold text-white">Drop to upload</p>
								<p className="mt-1 text-sm text-muted">Files will be saved to {path === "/" ? "Storage" : path}</p>
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
	className,
	children,
}: {
	label: string;
	onClick: () => void;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
			className={`grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white ${className ?? ""}`}
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
				transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
				className="grid size-16 place-items-center rounded-3xl border border-white/10 bg-gradient-to-br from-sky-400/15 to-violet-400/10 text-sky-300 shadow-[0_0_40px_-10px_rgba(56,189,248,0.6)]"
			>
				{icon}
			</motion.div>
			<p className="mt-5 font-medium text-white">{title}</p>
			<p className="mt-1 text-sm text-muted">{text}</p>
			{action ? <div className="mt-5">{action}</div> : null}
		</motion.div>
	);
}
