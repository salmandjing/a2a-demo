# What Is Built

A chronological log of features, fixes, and changes made to this project.

---

## 2026-02-04

### Multi-Agent Healthcare CX Demo - Core Implementation
- **Project setup**: pyproject.toml, requirements.txt, .env.example, .gitignore
- **Shared infrastructure**: Configuration module (`shared/config.py`) with env var loading, mock data paths
- **Mock data**: ServiceNow billing/tickets/appointments data, Salesforce patient/insurance/care history data

### ServiceNow Agent
- Domain agent for billing operations, ticket management, and appointment scheduling
- Tools: `billing_lookup`, `billing_correct`, `ticket_create`, `appointment_schedule`
- A2A server wrapper (port 8001) and AgentCore Runtime entrypoint
- Files: `agents/servicenow/{agent.py, prompts.py, a2a_server.py, agentcore_app.py}`

### Salesforce Agent
- Domain agent for patient records, insurance verification, care history, and case management
- Tools: `patient_lookup`, `insurance_verify`, `care_history`, `case_create`
- A2A server wrapper (port 8002) and AgentCore Runtime entrypoint
- Files: `agents/salesforce/{agent.py, prompts.py, a2a_server.py, agentcore_app.py}`

### Orchestrator Agent
- Patient-facing conversational agent that coordinates ServiceNow and Salesforce agents
- Tools: `servicenow_agent_tool`, `salesforce_agent_tool` (with direct/A2A mode switching)
- AgentCore Runtime entrypoint
- Files: `agents/orchestrator/{agent.py, prompts.py, a2a_tools.py, agentcore_app.py}`

### Test Scripts
- `scripts/local_test.py`: Test individual agents or full orchestrator flow locally
- `scripts/deploy_all.sh`: Deploy all agents to AgentCore Runtime
- `scripts/teardown.sh`: Delete AgentCore Runtimes

### Frontend Chat UI with Real-Time Agent Streaming
- FastAPI server (`server.py`) with SSE streaming endpoint (`/api/chat/stream`)
- Responsive chat interface with MidAtlantic Health branding
- **Real-time Agent Activity Panel** with Server-Sent Events streaming
  - Events appear as they happen (not batched at the end)
  - Spinning indicators while agents are working
  - Detailed trace info: task type, extracted results (Bill IDs, Case IDs, amounts)
  - Color-coded by agent (purple=Orchestrator, orange=ServiceNow, cyan=Salesforce)
- **Architecture Diagram** that highlights active agents during processing
- **Reset button** to clear conversation and start fresh
- **Improved demo scenarios** with step-by-step flow and standalone functionality
- Files: `server.py`, `frontend/{index.html, styles.css, app.js}`

### Local Testing Verified
- All 3 agents tested successfully with Amazon Bedrock (Claude Sonnet 4)
- Full orchestrator flow working: billing dispute → parallel agent calls → correction + case creation
- Demo scenario produces patient-friendly response with reference numbers (CORR-*, CASE-*)

### Initial Documentation Setup
- Created documentation structure with `WHAT_IS_BUILT.md`, `PROGRESS.md`, and `ARCHITECTURE.md`
- Added `CLAUDE.md` with rules for progressive documentation updates
