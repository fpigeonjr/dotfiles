# KOShelf server management functions
# Start KOShelf server with Podman machine and docker-compose
start_koshelf() {
  echo "🚀 Starting KOShelf server..."
  
  # Check if we're in the right directory
  local koshelf_dir="/Users/fpigeonjr/Code/koshelf"
  
  # Start Podman machine
  echo "Starting Podman machine..."
  podman machine start || {
    echo "❌ Failed to start Podman machine"
    return 1
  }
  
  # Wait a moment for machine to fully initialize
  sleep 3
  
  # Navigate to KOShelf directory and start services
  echo "Starting KOShelf services..."
  (cd "$koshelf_dir" && podman-compose up -d) || {
    echo "❌ Failed to start KOShelf services"
    return 1
  }
  
  # Wait for services to be ready
  sleep 5
  
  # Test connectivity
  echo "Testing server connectivity..."
  if curl -s -I http://127.0.0.1:8090 >/dev/null 2>&1; then
    echo "✅ KOShelf server is running!"
    echo "📚 Access your library at: http://koshelf.books"
    echo "🔗 Direct access: http://localhost:8090"
  else
    echo "⚠️  Services started but server not responding yet. Check with: podman ps"
  fi
}

# Stop KOShelf services
stop_koshelf() {
  echo "⏹️  Stopping KOShelf server..."
  
  local koshelf_dir="/Users/fpigeonjr/Code/koshelf"
  
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
  
  local koshelf_dir="/Users/fpigeonjr/Code/koshelf"
  
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
  local koshelf_dir="/Users/fpigeonjr/Code/koshelf"
  
  echo "📋 KOShelf Logs:"
  (cd "$koshelf_dir" && podman logs --tail=50 koshelf-app)
}
