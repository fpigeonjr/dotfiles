# Flexion Bedrock setup helpers.
# Usage:
#   flexion-claude
#   flexion-opencode

FLEXION_BEDROCK_PROFILE="ClaudeCodeAccess-FlexionLLM"
FLEXION_BEDROCK_REGION="us-east-2"
FLEXION_CLAUDE_MODEL="us.anthropic.claude-sonnet-4-20250514-v1:0"
FLEXION_OPENCODE_MODEL="amazon-bedrock/claude-sonnet-4-6"

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

  echo "🚀 Logging into AWS SSO for profile: $AWS_PROFILE"
  aws sso login || {
    echo "❌ AWS SSO login failed"
    return 1
  }

  if [[ "$export_credentials" != "1" ]]; then
    return 0
  fi

  echo "🔑 Exporting AWS credentials..."
  eval "$(aws configure export-credentials --format env)" || {
    echo "❌ Failed to export AWS credentials"
    return 1
  }
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
  echo "  AWS_PROFILE=$AWS_PROFILE"
  echo "  AWS_REGION=$AWS_REGION"
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
