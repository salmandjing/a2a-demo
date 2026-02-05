"""AgentCore Runtime entrypoint for the Salesforce Agent."""

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from agents.salesforce.agent import salesforce_agent

app = BedrockAgentCoreApp()


@app.entrypoint
def invoke(input_data: dict) -> dict:
    user_message = input_data.get("input", {}).get("text", "")
    result = salesforce_agent(user_message)
    return {"output": {"text": str(result)}}


if __name__ == "__main__":
    app.run()
