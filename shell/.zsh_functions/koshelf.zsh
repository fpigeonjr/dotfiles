# KOShelf server management functions

# Poll until a command succeeds or timeout is reached.
# Usage: _koshelf_wait_for <timeout_seconds> <description> <command...>
_koshelf_wait_for() {
  local timeout=$1
  local description=$2
  shift 2
  local i=0
  while ! "$@" >/dev/null 2>&1; do
    (( i++ ))
    if (( i >= timeout )); then
      echo "  Timed out waiting for $description after ${timeout}s"
      return 1
    fi
    printf "."
    sleep 1
  done
  echo " ready"
}

# Start KOShelf server with Podman machine and docker-compose
start_koshelf() {
  echo "Starting KOShelf server..."

  local koshelf_dir="$HOME/Code/koshelf"

  # Start Podman machine
  echo "Starting Podman machine..."
  podman machine start || {
    echo "Failed to start Podman machine"
    return 1
  }

  # Wait for Podman machine to be responsive (up to 30s)
  printf "Waiting for Podman machine"
  _koshelf_wait_for 30 "Podman machine" podman info || return 1

  # Start KOShelf services
  echo "Starting KOShelf services..."
  (cd "$koshelf_dir" && podman-compose up -d) || {
    echo "Failed to start KOShelf services"
    return 1
  }

  # Wait for HTTP server to respond (up to 30s)
  printf "Waiting for KOShelf server"
  _koshelf_wait_for 30 "KOShelf server" curl -sf http://127.0.0.1:8090 || {
    echo "Services started but server not responding. Check with: podman ps"
    return 1
  }

  echo "KOShelf server is running!"
  echo "  Library : http://koshelf.books"
  echo "  Direct  : http://localhost:8090"
}

# Stop KOShelf services
stop_koshelf() {
  echo "⏹️  Stopping KOShelf server..."
  
  local koshelf_dir="$HOME/Code/koshelf"
  
  # Stop services
  (cd "$koshelf_dir" && podman-compose down) || {
    echo "❌ Failed to stop KOShelf services"
    return 1
  }
  
  echo "✅ KOShelf services stopped"
}

# Restart KOShelf services (rebuild and restart)
restart_koshelf() {
  echo "🔄 Restarting KOShelf server..."
  
  local koshelf_dir="$HOME/Code/koshelf"
  
  # Stop services
  (cd "$koshelf_dir" && podman-compose down)
  
  # Start services
  (cd "$koshelf_dir" && podman-compose up -d) || {
    echo "❌ Failed to restart KOShelf services"
    return 1
  }
  
  echo "✅ KOShelf server restarted"
}

# Show KOShelf status
koshelf_status() {
  echo "📊 KOShelf Status:"
  echo ""
  
  # Check Podman machine
  if podman machine list | grep -q "Currently running"; then
    echo "✅ Podman machine: Running"
  else
    echo "❌ Podman machine: Stopped"
    return 1
  fi
  
  # Check containers
  echo "🐳 Container Status:"
  podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  
  # Test connectivity
  echo ""
  echo "🌐 Connectivity:"
  if curl -s -I http://127.0.0.1:8090 >/dev/null 2>&1; then
    echo "✅ Local access (http://localhost:8090): Working"
  else
    echo "❌ Local access (http://localhost:8090): Not responding"
  fi
  
  if curl -s -I http://koshelf.books >/dev/null 2>&1; then
    echo "✅ Domain access (http://koshelf.books): Working"
  else
    echo "❌ Domain access (http://koshelf.books): Not responding"
  fi
}

# View KOShelf logs
koshelf_logs() {
  local koshelf_dir="$HOME/Code/koshelf"
  
  echo "📋 KOShelf Logs:"
  (cd "$koshelf_dir" && podman logs --tail=50 koshelf-app)
}
