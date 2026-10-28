import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
	variable: "--font-grotesk",
	subsets: ["latin", "latin-ext"],
	weight: ["400", "500", "700"],
});

const spaceMono = Space_Mono({
	variable: "--font-space-mono",
	subsets: ["latin", "latin-ext"],
	weight: ["400", "700"],
});

export const metadata: Metadata = {
	title: {
		default: "NodePilot",
		template: "%s · NodePilot",
	},
	description: "A unified, lightweight control panel for your home server.",
};

export const viewport: Viewport = {
	themeColor: "#264653",
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable} h-full antialiased`}>
			<body className="min-h-full">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
