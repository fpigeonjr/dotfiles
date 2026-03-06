# Flexion Claude Code Setup Function
# Sets up AWS Bedrock environment for Claude Code access via Flexion's AWS account
# Usage: flexion-claude

flexion-claude() {
  # Check dependencies
  for bin in aws fnm; do
    command -v "$bin" >/dev/null 2>&1 || {
      echo "❌ Missing $bin. Please install it first."
      if [[ "$bin" == "aws" ]]; then
        echo "   Install with: brew install awscli"
      elif [[ "$bin" == "fnm" ]]; then
        echo "   Install with: brew install fnm"
      fi
      return 1
    }
  done

  # Use LTS Node version with fnm
  echo "🔧 Setting up Node.js LTS version..."
  fnm use lts-latest 2>/dev/null || {
    echo "📦 Installing Node.js LTS..."
    fnm install --lts
    fnm use lts-latest
  }

  # AWS SSO Login function
  awsssologin() {
    local profile_id=$1
    echo "🔐 Clearing existing AWS environment variables..."
    
    # Clear existing AWS environment variables
    while read -r aws_var; do
      unset "$aws_var"
    done < <(env | grep AWS | awk -F= '{print $1}')
    
    export AWS_PROFILE=$profile_id
    echo "🚀 Logging into AWS SSO for profile: $profile_id"
    
    aws sso login
    if [[ $? -ne 0 ]]; then
      echo "❌ AWS SSO login failed"
      return 1
    fi
    
    echo "🔑 Exporting AWS credentials..."
    eval "$(aws configure export-credentials --format env)"
    
    if [[ $? -ne 0 ]]; then
      echo "❌ Failed to export AWS credentials"
      return 1
    fi
  }

  # Perform AWS SSO login
  awsssologin ClaudeCodeAccess-FlexionLLM
  
  # Unset AWS_PROFILE after credential export (as per original script)
  unset AWS_PROFILE

  # Set Claude Code environment variables that persist
  echo "⚙️  Setting Claude Code environment variables..."
  export CLAUDE_CODE_USE_BEDROCK=1
  
  # Optional: Uncomment to specify a specific Claude model
  # export ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-20250514-v1:0
  # export ANTHROPIC_MODEL=us.anthropic.claude-3-7-sonnet-20250219-v1:0
  
  # Add these exports to the current session's environment for persistence
  # This ensures they're available in the current shell session
  
  echo ""
  echo "✅ Environment setup complete!"
  echo "🤖 You can now run the 'claude' command against AWS Bedrock"
  echo ""
  echo "Environment variables set:"
  echo "  CLAUDE_CODE_USE_BEDROCK=1"
  echo "  AWS credentials exported from SSO"
  echo ""
  echo "💡 Note: These settings persist for this shell session only."
  echo "    Run 'flexion-claude' again in new shell sessions as needed."
  echo ""
  echo "🔧 To use a specific Claude model, uncomment and modify the"
  echo "   ANTHROPIC_MODEL export in ~/.zsh_functions/flexion-claude.zsh"
}