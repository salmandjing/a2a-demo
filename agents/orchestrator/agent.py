"""Orchestrator Agent — Patient-facing Strands Agent.

This agent owns the patient conversation. It has no direct data access.
It relies entirely on the ServiceNow and Salesforce agents via tools.
"""

from strands import Agent
from strands.models.bedrock import BedrockModel

from shared.config import BEDROCK_MODEL_ID, AWS_REGION
from agents.orchestrator.prompts import ORCHESTRATOR_SYSTEM_PROMPT
from agents.orchestrator.a2a_tools import servicenow_agent_tool, salesforce_agent_tool


def create_orchestrator_agent() -> Agent:
    """Create and return the Orchestrator Strands Agent."""
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
        region_name=AWS_REGION,
    )
    return Agent(
        name="MidAtlantic Health Virtual Assistant",
        description=(
            "Patient-facing conversational agent powered by Genesys Cloud. "
            "Coordinates with ServiceNow and Salesforce agents to resolve "
            "patient billing, insurance, and scheduling issues."
        ),
        model=model,
        system_prompt=ORCHESTRATOR_SYSTEM_PROMPT,
        tools=[servicenow_agent_tool, salesforce_agent_tool],
    )


orchestrator_agent = create_orchestrator_agent()
