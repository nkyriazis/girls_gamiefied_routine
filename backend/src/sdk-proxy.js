const path = require('path');

// Resolve paths relative to this file
const sdkRoot = path.resolve(__dirname, '../node_modules/@modelcontextprotocol/sdk/dist/cjs');

try {
    const streamableHttp = require(path.join(sdkRoot, 'server/streamableHttp.js'));
    const mcp = require(path.join(sdkRoot, 'server/mcp.js'));

    module.exports = {
        StreamableHTTPServerTransport: streamableHttp.StreamableHTTPServerTransport,
        McpServer: mcp.McpServer,
        ResourceTemplate: mcp.ResourceTemplate
    };
} catch (error) {
    console.error('Failed to load MCP SDK from proxy:', error);
    throw error;
}
