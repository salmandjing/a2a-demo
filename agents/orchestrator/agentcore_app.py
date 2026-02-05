"""AgentCore Runtime entrypoint for the Orchestrator Agent."""

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from agents.orchestrator.agent import orchestrator_agent

app = BedrockAgentCoreApp()


@app.entrypoint
def invoke(input_data: dict) -> dict:
    user_message = input_data.get("input", {}).get("text", "")
    result = orchestrator_agent(user_message)
    return {"output": {"text": str(result)}}


if __name__ == "__main__":
    app.run()
