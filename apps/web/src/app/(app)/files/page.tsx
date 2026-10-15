"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FileBrowser } from "@/components/files/file-browser";

export default function FilesPage() {
	return (
		<Suspense fallback={null}>
			<FilesRoute />
		</Suspense>
	);
}

function FilesRoute() {
	const path = useSearchParams().get("path") || "/";

	return <FileBrowser path={path} />;
}
