"""A2A Server for the ServiceNow Agent.

Run this to expose the ServiceNow agent as an A2A-compatible server.
Strands auto-generates the Agent Card from the agent's name, description,
and tools — no manual agent_card.json needed.
"""

from strands.multiagent.a2a import A2AServer
from agents.servicenow.agent import servicenow_agent

a2a_server = A2AServer(
    agent=servicenow_agent,
    host="0.0.0.0",
    port=8001,
)

if __name__ == "__main__":
    print("Starting ServiceNow A2A Server on port 8001...")
    a2a_server.serve()
