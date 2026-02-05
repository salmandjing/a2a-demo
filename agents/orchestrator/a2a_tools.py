"""A2A client tool wrappers for remote agents.

Two modes are provided:

1. A2A Protocol Mode (a2a_tools): Uses the A2A protocol for cross-platform
   agent communication. Use this for the live demo to show A2A in action.

2. Direct Mode (direct_tools): Calls agent instances directly in-process.
   Use this for local testing and development — faster iteration, no network.

Both produce the same agent behavior. Switch via AGENT_MODE env var.
"""

import os
import json
from strands import tool

# ── Mode Selection ──────────────────────────────────────────────

AGENT_MODE = os.getenv("AGENT_MODE", "direct")  # "direct" or "a2a"


# ── Direct Mode Tools (Local Development) ───────────────────────
# Import agents directly — no network, no A2A overhead.

def _get_servicenow_agent():
    from agents.servicenow.agent import servicenow_agent
    return servicenow_agent

def _get_salesforce_agent():
    from agents.salesforce.agent import salesforce_agent
    return salesforce_agent


@tool
def servicenow_agent_tool(task: str) -> str:
    """Send a task to the ServiceNow AI Agent.

    Use this for billing lookups, billing corrections, creating service tickets,
    or scheduling appointments. Be specific about what you need — include
    patient IDs, bill IDs, and the action you want performed.

    Args:
        task: Natural language description of the task for the ServiceNow agent.
    """
    if AGENT_MODE == "a2a":
        return _call_a2a_agent(
            os.getenv("SERVICENOW_AGENT_URL", "http://localhost:8001"),
            task
        )
    agent = _get_servicenow_agent()
    result = agent(task)
    return str(result)


@tool
def salesforce_agent_tool(task: str) -> str:
    """Send a task to the Salesforce Health Cloud Agent.

    Use this for patient record lookups, insurance verification,
    care history retrieval, or creating patient cases. Include patient IDs
    and specify what information you need.

    Args:
        task: Natural language description of the task for the Salesforce agent.
    """
    if AGENT_MODE == "a2a":
        return _call_a2a_agent(
            os.getenv("SALESFORCE_AGENT_URL", "http://localhost:8002"),
            task
        )
    agent = _get_salesforce_agent()
    result = agent(task)
    return str(result)


# ── A2A Protocol Mode ───────────────────────────────────────────
# Uses the A2A protocol for real network communication.

def _call_a2a_agent(agent_url: str, task: str) -> str:
    """Send a task to a remote A2A agent and return its response."""
    import asyncio
    import httpx
    from uuid import uuid4
    from a2a.client import A2ACardResolver, ClientConfig, ClientFactory
    from a2a.types import Message, Part, Role, TextPart

    async def _send():
        async with httpx.AsyncClient(timeout=60) as httpx_client:
            # Discover agent card
            resolver = A2ACardResolver(
                httpx_client=httpx_client,
                base_url=agent_url
            )
            agent_card = await resolver.get_agent_card()

            # Create client and send message
            config = ClientConfig(httpx_client=httpx_client, streaming=False)
            factory = ClientFactory(config)
            client = factory.create(agent_card)

            message = Message(
                role=Role.user,
                parts=[Part(root=TextPart(text=task))],
                messageId=str(uuid4()),
            )
            response = await client.send_message(message=message)
            return str(response)

    # Run async in sync context (Strands tools are sync)
    try:
        loop = asyncio.get_running_loop()
        # If already in an async context, create a task
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            result = loop.run_in_executor(pool, asyncio.run, _send())
            return asyncio.ensure_future(result)
    except RuntimeError:
        # No running loop — safe to use asyncio.run
        return asyncio.run(_send())
