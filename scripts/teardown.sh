#!/bin/bash
# Delete all AgentCore Runtimes. Run from project root.

set -e

echo "Deleting AgentCore Runtimes..."
echo "Use the AWS Console or boto3 DeleteAgentRuntime with the ARNs from .env"
echo ""
echo "Example:"
echo "  aws bedrock-agentcore delete-agent-runtime --agent-runtime-id <ID>"
