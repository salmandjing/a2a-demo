"""Centralized configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()

# AWS
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_PROFILE = os.getenv("AWS_PROFILE", "default")

# Bedrock model
BEDROCK_MODEL_ID = os.getenv(
    "BEDROCK_MODEL_ID",
    "us.anthropic.claude-sonnet-4-20250514-v1:0"
)

# Agent URLs (local dev defaults)
SERVICENOW_AGENT_URL = os.getenv("SERVICENOW_AGENT_URL", "http://localhost:8001")
SALESFORCE_AGENT_URL = os.getenv("SALESFORCE_AGENT_URL", "http://localhost:8002")
ORCHESTRATOR_PORT = int(os.getenv("ORCHESTRATOR_PORT", "8000"))

# AgentCore ARNs (populated after deployment)
SERVICENOW_AGENTCORE_ARN = os.getenv("SERVICENOW_AGENTCORE_ARN", "")
SALESFORCE_AGENTCORE_ARN = os.getenv("SALESFORCE_AGENTCORE_ARN", "")
ORCHESTRATOR_AGENTCORE_ARN = os.getenv("ORCHESTRATOR_AGENTCORE_ARN", "")

# Data paths
import pathlib
DATA_DIR = pathlib.Path(__file__).parent / "mock_data"
SERVICENOW_DATA_PATH = DATA_DIR / "servicenow.json"
SALESFORCE_DATA_PATH = DATA_DIR / "salesforce.json"
