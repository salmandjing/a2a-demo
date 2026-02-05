"""A2A Server for the Salesforce Agent."""

from strands.multiagent.a2a import A2AServer
from agents.salesforce.agent import salesforce_agent

a2a_server = A2AServer(
    agent=salesforce_agent,
    host="0.0.0.0",
    port=8002,
)

if __name__ == "__main__":
    print("Starting Salesforce A2A Server on port 8002...")
    a2a_server.serve()
