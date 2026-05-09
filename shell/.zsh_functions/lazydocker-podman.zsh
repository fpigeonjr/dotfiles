lazydocker_podman() {
  local podman_socket
  local compose_project_name
  local compose_profiles

  if [[ "$1" == "--setup" ]]; then
    compose_profiles="setup"
    shift
  fi

  podman_socket=$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}' 2>/dev/null | head -n 1)

  if [[ -z "$podman_socket" ]]; then
    echo "Could not determine the Podman API socket." >&2
    return 1
  fi

  # Always sanitize the compose project name to lowercase to avoid
  # Podman/Lazydocker compose naming issues with uppercase repo/worktree names.
  compose_project_name=${PWD:t:l}
  compose_project_name=${compose_project_name//[^a-z0-9_-]/_}

  if [[ ! "$compose_project_name" =~ ^[a-z0-9] ]]; then
    compose_project_name="proj_${compose_project_name}"
  fi

  DOCKER_HOST="unix://$podman_socket" COMPOSE_PROJECT_NAME="$compose_project_name" COMPOSE_PROFILES="$compose_profiles" lazydocker "$@"
}

alias ld='lazydocker_podman'
alias lds='lazydocker_podman --setup'
