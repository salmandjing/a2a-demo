"""AgentCore Runtime entrypoint for the ServiceNow Agent.

This file is the entrypoint specified during `agentcore configure`.
AgentCore Runtime calls the decorated function for each invocation.
"""

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from agents.servicenow.agent import servicenow_agent

app = BedrockAgentCoreApp()


@app.entrypoint
def invoke(input_data: dict) -> dict:
    """AgentCore Runtime invocation handler."""
    user_message = input_data.get("input", {}).get("text", "")
    result = servicenow_agent(user_message)
    return {"output": {"text": str(result)}}


if __name__ == "__main__":
    app.run()
