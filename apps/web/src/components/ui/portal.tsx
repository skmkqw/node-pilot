"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into document.body. Needed for fixed overlays, because an animated
 * ancestor with `transform`/`filter` would otherwise become their containing block.
 */
export function Portal({ children }: { children: React.ReactNode }) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	return mounted ? createPortal(children, document.body) : null;
}
