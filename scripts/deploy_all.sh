#!/bin/bash
# Deploy all three agents to AgentCore Runtime.
# Run from project root: ./scripts/deploy_all.sh

set -e

echo "=== Deploying ServiceNow Agent ==="
cd agents/servicenow
agentcore configure -e agentcore_app.py --disable-memory
agentcore deploy
cd ../..

echo ""
echo "=== Deploying Salesforce Agent ==="
cd agents/salesforce
agentcore configure -e agentcore_app.py --disable-memory
agentcore deploy
cd ../..

echo ""
echo "=== Deploying Orchestrator Agent ==="
cd agents/orchestrator
agentcore configure -e agentcore_app.py --disable-memory
agentcore deploy
cd ../..

echo ""
echo "=== All agents deployed ==="
echo "Update .env with the AgentCore ARNs from the output above."
echo "Set AGENT_MODE=a2a and update SERVICENOW_AGENT_URL / SALESFORCE_AGENT_URL"
echo "with the AgentCore Runtime HTTPS endpoints."
