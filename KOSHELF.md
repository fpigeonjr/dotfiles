# KOShelf Server Management

Quick reference for managing your KOShelf ebook library server.

## Available Commands

| Command | Function | Description |
|---------|----------|-------------|
| `koshelf-start` | `start_koshelf()` | Start Podman machine and KOShelf services |
| `koshelf-stop` | `stop_koshelf()` | Stop KOShelf services |
| `koshelf-restart` | `restart_koshelf()` | Restart KOShelf services |
| `koshelf-status` | `koshelf_status()` | Show status of machine, containers, and connectivity |
| `koshelf-logs` | `koshelf_logs()` | View recent KOShelf application logs |
| `library` | - | Open KOShelf library in browser |

## After System Reboot

After restarting your Mac, run:
```bash
koshelf-start
```

This will:
1. Start the Podman machine
2. Start KOShelf containers
3. Test connectivity
4. Provide access URLs

## Access URLs

- **Domain access**: http://koshelf.books (requires nginx reverse proxy)
- **Direct access**: http://localhost:8090
- **Network access**: http://192.168.1.150:8090

## Manual Commands

If you prefer manual control:
```bash
# Start Podman machine
podman machine start

# Navigate to project and start services
cd ~/Code/koshelf
podman-compose up -d

# Check container status
podman ps

# View logs
podman logs koshelf-app
```

## Troubleshooting

1. **502 Bad Gateway on koshelf.books**: nginx reverse proxy not running
   ```bash
   sudo nginx  # Start nginx if stopped
   ```

2. **Connection refused**: Podman machine not running
   ```bash
   koshelf-start  # Will restart everything
   ```

3. **Services not responding**: Check container status
   ```bash
   koshelf-status
   koshelf-logs
   ```
