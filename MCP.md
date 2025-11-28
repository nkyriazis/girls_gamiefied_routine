# MCP Server Integration

This project includes a Model Context Protocol (MCP) server that allows LLM agents to read and write data programmatically.

## Endpoint

```
POST /mcp
```

The MCP endpoint uses the **Streamable HTTP Transport** (stateless mode) - the modern MCP transport that replaces SSE.

## Public Access via ngrok Tunnel

1. Add your ngrok auth token to `.env` (see `.env.example`).
2. Start the stack with the tunnel profile (combine base + dev if needed):

       ```bash
       docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile mcp up -d
       ```

3. Tail the tunnel logs to discover the public URLs (both HTTP and HTTPS):

       ```bash
       docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f tunnel
       ```

       You will see lines like:

       ```
       https://your-subdomain.ngrok-free.app -> http://backend:3000
       ```

Your MCP endpoint is then available at the HTTPS URL, e.g.:

```
https://your-subdomain.ngrok-free.app/mcp
```

## Connecting MCP Clients

### VS Code / Copilot

```bash
code --add-mcp "{\"name\":\"routine\",\"type\":\"http\",\"url\":\"https://your-subdomain.ngrok-free.app/mcp\"}"
```

### Claude Code

```bash
claude mcp add --transport http routine https://your-subdomain.ngrok-free.app/mcp
```

### MCP Inspector (for testing)

```bash
npx @modelcontextprotocol/inspector
# Then connect to: https://your-subdomain.ngrok-free.app/mcp
```

## Available Tools

### Read Operations

| Tool | Description |
|------|-------------|
| `get_config` | Get full data.json configuration |
| `get_state` | Get runtime state (stars, executions, spendings) |
| `get_users` | List all users with current star balances |
| `get_user` | Get a single user by ID |
| `get_user_stars` | Get star balance for a specific user |
| `get_tasks` | List all task definitions |
| `get_task` | Get a single task by ID |
| `get_routines` | List all routine definitions |
| `get_routine` | Get a single routine by ID |
| `get_rewards` | List all reward definitions |
| `get_reward` | Get a single reward by ID |
| `get_schedules` | List all cron schedules |
| `get_schedule` | Get a single schedule by ID |
| `get_flows` | List all flow definitions |
| `get_flow` | Get a single flow by ID |
| `get_routine_assignments` | List all user-specific routine assignments |
| `get_routine_assignment` | Get a single routine assignment by ID |
| `get_spendings` | Get reward redemption history |

### Write Operations

| Tool | Description |
|------|-------------|
| `add_task` | Add a new task definition |
| `update_task` | Update an existing task |
| `delete_task` | Delete a task by ID |
| `add_user` | Add a new user |
| `update_user` | Update an existing user |
| `add_reward` | Add a new reward |
| `update_reward` | Update an existing reward |
| `delete_reward` | Delete a reward by ID |
| `add_schedule` | Add a new cron schedule |
| `update_schedule` | Update an existing schedule |
| `delete_schedule` | Delete a schedule by ID |
| `trigger_action` | Manually trigger a routine or flow |
| `award_stars` | Award stars to a user (adds to balance) |
| `set_user_stars` | Set a user's star balance to an absolute value |

## Available Resources

| URI | Description |
|-----|-------------|
| `uploads://list` | List all uploaded files |
| `uploads://{filename}` | Get a specific uploaded file (base64 encoded) |
| `schema://data` | JSON Schema for data.json |
| `schema://state` | JSON Schema for state.json |

## Example: Using with an LLM

An LLM agent connected via MCP can:

1. **Query current state**: "How many stars does each user have?"
2. **Award stars**: "Give Alice 5 stars for helping with chores"
3. **Trigger routines**: "Start the morning routine for Bob"
4. **Add rewards**: "Add a new reward called 'Extra TV Time' that costs 10 stars"
5. **Check schedules**: "What routines are scheduled for tomorrow morning?"

## Security

The MCP endpoint has no authentication - security relies on controlling tunnel access:
- ngrok free tunnels generate random subdomains; don't share the URL publicly
- Sessions expire after ~2 hours on the free tier (restart to get a new URL)
- Add basic auth or reserve a static domain via ngrok paid plans if you need persistence

For production use, consider re-enabling `MCP_API_KEY` or securing the tunnel with ngrok's access controls.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   LLM Agent     │────▶│  ngrok Tunnel   │────▶│ Backend Server  │
│ (Claude, etc.)  │     │ (HTTP/HTTPS)    │     │   POST /mcp     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────────┐
                                                  │   data.json     │
                                                  │   state.json    │
                                                  │   uploads/      │
                                                  └─────────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────────┐
                                                  │   WebSocket     │──▶ Real-time
                                                  │   Broadcast     │    Frontend
                                                  └─────────────────┘
```

Changes made via MCP tools are broadcast to connected frontends via WebSocket, so the UI updates in real-time.
