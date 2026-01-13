# Scalable Multi-Instance WhatsApp Bot

This bot is designed to handle up to 20 WhatsApp instances concurrently, managed via a REST API. It uses a queuing system to ensure stability and simulates human behavior to minimize the risk of bans.

## Cluster Management Details
- **Manual Startup**: No instance starts automatically. You must call the `/instances/init/:id` endpoint for each bot you want to activate.
- **Allocation Strategy**:
    - **12 Instances**: One for each department (e.g., `id=Alibori`, `id=Atacora`, etc.).
    - **8 Instances**: Backup / Relay instances to handle overflow or failures.
- **REST API**: Manage instances (init, scan QR, status, stop).
- **Queuing**: Uses `Bull` and `Redis` for robust message processing.
- **Stealth Mode**: 5-second delays and typing simulation for human-like interaction.

## API Endpoints
- `POST /instances/init/:id`: Initialize bot with a specific ID.
- `GET /instances/status`: Get health and connectivity status of all instances.
- `GET /instances/qr/:id`: View the QR code for a specific instance in your browser.
- `POST /instances/stop/:id`: Stop and destroy a specific instance.

## Installation & Setup
1. **Requirements**: Node.js 18+, Redis server, MySQL.
2. **Setup**:
   ```bash
   cd whatsapp-bot
   npm install
   ```
3. **Run**:
   ```bash
   npm start
   ```

## Example Workflow
1. Start the server: `npm start`.
2. Activate a Department bot: `curl -X POST http://localhost:3000/instances/init/Littoral`.
3. Activate a Relay bot: `curl -X POST http://localhost:3000/instances/init/Relay1`.
4. Open browser: `http://localhost:3000/instances/qr/Littoral` to scan.
4. Check status: `curl http://localhost:3000/instances/status`.
