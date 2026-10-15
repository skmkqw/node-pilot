"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};

/**
 * Renders children into document.body. Needed for fixed overlays, because an animated
 * ancestor with `transform`/`filter` would otherwise become their containing block.
 */
export function Portal({ children }: { children: React.ReactNode }) {
	// false during server rendering and hydration, true on the client afterwards.
	const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

	return isClient ? createPortal(children, document.body) : null;
}
