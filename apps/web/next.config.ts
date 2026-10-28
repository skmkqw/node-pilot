import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// The dev server only trusts `localhost` by default. Allow this machine's LAN addresses
// too, so the panel can be tested from a phone (e.g. http://192.168.1.20:3000).
// This setting has no effect on production builds.
const lanAddresses = Object.values(networkInterfaces())
	.flat()
	.filter((address) => address !== undefined && address.family === "IPv4" && !address.internal)
	.map((address) => address!.address);

const nextConfig: NextConfig = {
	output: "standalone",
	allowedDevOrigins: lanAddresses,
};

export default nextConfig;
