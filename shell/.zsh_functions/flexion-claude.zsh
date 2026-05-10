# Flexion Bedrock setup helpers.
# Usage:
#   flexion-claude
#   flexion-opencode
#   flexion-pi
#
# This file is a no-op on machines without the AWS CLI (e.g. GFE).
command -v aws >/dev/null 2>&1 || return 0

FLEXION_BEDROCK_PROFILE="ClaudeCodeAccess-FlexionLLM"
FLEXION_BEDROCK_REGION="us-east-2"
FLEXION_CLAUDE_MODEL="us.anthropic.claude-sonnet-4-20250514-v1:0"
FLEXION_OPENCODE_MODEL="amazon-bedrock/claude-sonnet-4-6"
FLEXION_PI_MODEL="us.anthropic.claude-sonnet-4-6"

flexion_require_bin() {
  local bin=$1

  command -v "$bin" >/dev/null 2>&1 && return 0

  echo "❌ Missing $bin. Please install it first."
  if [[ "$bin" == "aws" ]]; then
    echo "   Install with: brew install awscli"
  elif [[ "$bin" == "fnm" ]]; then
    echo "   Install with: brew install fnm"
  fi

  return 1
}

flexion_use_lts_node() {
  flexion_require_bin fnm || return 1

  echo "🔧 Setting up Node.js LTS version..."
  fnm use lts-latest 2>/dev/null || {
    echo "📦 Installing Node.js LTS..."
    fnm install --lts
    fnm use lts-latest
  }
}

flexion_export_aws_credentials() {
  local aws_creds
  local key
  local value

  echo "🔑 Exporting AWS credentials..."
  if ! aws_creds="$(aws configure export-credentials --format env-no-export 2>/dev/null)"; then
    echo "❌ Failed to export AWS credentials"
    return 1
  fi

  if [[ -z "$aws_creds" ]]; then
    echo "❌ Failed to export AWS credentials (no credentials returned)"
    return 1
  fi

  while IFS='=' read -r key value; do
    [[ -z "$key" ]] && continue

    case "$key" in
      AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|AWS_CREDENTIAL_EXPIRATION)
        export "$key=$value"
        ;;
    esac
  done <<< "$aws_creds"
}

flexion_sso_session_valid() {
  # Returns 0 (true) if existing SSO credentials are still valid.
  # Uses --format env-no-export (instead of json) because the JSON format triggers
  # a spurious SSO login prompt on some awscli versions when the session is expired,
  # whereas env-no-export fails cleanly with a non-zero exit code.
  aws configure export-credentials --profile "$FLEXION_BEDROCK_PROFILE" --format env-no-export \
    >/dev/null 2>&1
}

flexion_bedrock_login() {
  local export_credentials=${1:-1}
  local aws_var

  flexion_require_bin aws || return 1
  flexion_use_lts_node || return 1

  echo "🔐 Clearing existing AWS environment variables..."
  while read -r aws_var; do
    unset "$aws_var"
  done < <(env | grep '^AWS[A-Z0-9_]*=' | awk -F= '{print $1}')

  export AWS_PROFILE="$FLEXION_BEDROCK_PROFILE"
  export AWS_REGION="$FLEXION_BEDROCK_REGION"
  export AWS_DEFAULT_REGION="$FLEXION_BEDROCK_REGION"

  if ! aws configure list-profiles 2>/dev/null | grep -q "^${FLEXION_BEDROCK_PROFILE}$"; then
    echo "❌ AWS profile '${FLEXION_BEDROCK_PROFILE}' not found in ~/.aws/config"
    echo "   Fix: run 'stow aws' from ~/dotfiles"
    return 1
  fi

  if flexion_sso_session_valid; then
    echo "✅ SSO session still valid — skipping login"
  else
    echo "🚀 Logging into AWS SSO for profile: $AWS_PROFILE"
    aws sso login || {
      echo "❌ AWS SSO login failed"
      return 1
    }
  fi

  if [[ "$export_credentials" != "1" ]]; then
    return 0
  fi

  flexion_export_aws_credentials || return 1
  unset AWS_PROFILE
}

flexion-claude() {
  flexion_bedrock_login 1 || return 1

  echo "⚙️  Setting Claude Code environment variables..."
  export CLAUDE_CODE_USE_BEDROCK=1
  export ANTHROPIC_MODEL="${ANTHROPIC_MODEL:-$FLEXION_CLAUDE_MODEL}"

  echo ""
  echo "✅ Environment setup complete!"
  echo "🤖 You can now run the 'claude' command against AWS Bedrock"
  echo ""
  echo "Environment variables set:"
  echo "  AWS_REGION=$AWS_REGION"
  echo "  AWS credentials exported from SSO"
  echo "  CLAUDE_CODE_USE_BEDROCK=1"
  echo "  ANTHROPIC_MODEL=$ANTHROPIC_MODEL"
  echo ""
  echo "💡 Note: These settings persist for this shell session only."
  echo "   Run 'flexion-claude' again in new shell sessions as needed."
}

flexion-opencode() {
  flexion_require_bin opencode || return 1
  flexion_bedrock_login 0 || return 1

  echo "⚙️  Setting OpenCode environment variables..."
  export OPENCODE_MODEL="${OPENCODE_MODEL:-$FLEXION_OPENCODE_MODEL}"

  echo ""
  echo "✅ Environment setup complete!"
  echo "🤖 Launching 'opencode' against AWS Bedrock"
  echo ""
  echo "Environment variables set:"
  echo "  AWS_PROFILE=$AWS_PROFILE"
  echo "  AWS_REGION=$AWS_REGION"
  echo "  OPENCODE_MODEL=$OPENCODE_MODEL"
  echo ""
  echo "💡 If your company uses a Bedrock inference profile ARN,"
  echo "   update ~/.config/opencode/opencode.json to map it."

  opencode "$@"
}

# ─── Shell launch aliases with auto-auth ─────────────────────────────────────
# Ensures a valid SSO session before launching each AI tool.
# - claude: SSO check only (AWS_PROFILE + awsAuthRefresh baked into ~/.claude/settings.json)
# - opencode: SSO check only (profile baked into ~/.config/opencode/opencode.json)
# - pi: handled separately via alias pi='flexion-pi' in macos.zsh (needs raw cred export)

_flexion_ensure_sso() {
  if ! flexion_sso_session_valid; then
    aws sso login --profile "$FLEXION_BEDROCK_PROFILE"
  fi
}

alias claude='_flexion_ensure_sso && command claude'
alias opencode='_flexion_ensure_sso && command opencode'

flexion-pi() {
  flexion_require_bin pi || return 1
  flexion_bedrock_login 1 || return 1

  echo "⚙️  Setting pi environment variables..."
  export PI_MODEL="${PI_MODEL:-$FLEXION_PI_MODEL}"

  echo ""
  echo "✅ Environment setup complete!"
  echo "🤖 Launching 'pi' against AWS Bedrock"
  echo ""
  echo "Environment variables set:"
  echo "  AWS_REGION=$AWS_REGION"
  echo "  AWS credentials exported from SSO"
  echo "  PI_MODEL=$PI_MODEL"
  echo ""
  echo "💡 Override the model for this run by passing --model <id>."

  pi --provider amazon-bedrock --model "$PI_MODEL" "$@"
}
