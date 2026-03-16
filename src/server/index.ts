/**
 * MCP server entry — stdio transport.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { resolve } from "node:path";

export async function startServer(vaultPath: string) {
  const vaultRoot = resolve(vaultPath);
  const server = createServer(vaultRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
