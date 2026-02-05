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

---

## 2026-02-05

### Full Observability & Enhanced UX Improvements

#### Agent "Thinking" Stream
- Real-time display of agent reasoning process in trace panel
- Shows what the orchestrator is considering before taking action
- Purple-tinted thinking events with thought bubble (💭) icon
- Truncates long thoughts with expandable detail view

#### Visual Data Cards
- Rich visual cards for billing, insurance, correction, and case data
- Displays key fields in an easy-to-read grid format
- Color-coded values: red for errors, green for success, blue for highlights
- Cards appear inline with trace events when relevant data is extracted

#### Expandable Trace Details
- Click any trace event to expand and see raw JSON data
- Shows full input/output for debugging and transparency
- Helps developers understand agent tool calls

#### Conversation Memory & Session Persistence
- Backend stores conversation history per session
- Patient context is remembered across messages (name, ID, issue type)
- Session ID persisted between requests
- Reset button properly clears server-side session

#### Timing Breakdown & Metrics Panel
- Visual timing bar showing time spent in each agent
- Color-coded segments: purple (Orchestrator), orange (ServiceNow), cyan (Salesforce)
- Token count display (input + output)
- Estimated cost calculation based on Claude pricing

#### JSON View Toggle
- `{ }` button in trace header to view raw JSON of all events
- Modal overlay with syntax-highlighted JSON
- Useful for debugging and demo presentations

#### Error Scenario Demo
- Added "Unknown Patient" demo button (PAT-9999)
- Tests graceful error handling when data doesn't exist
- Yellow-styled button to indicate error scenario

### Files Updated
- `server.py`: Major rewrite with ConversationSession, TraceCollector, visual data extraction
- `frontend/index.html`: Added metrics panel, JSON modal, error demo button
- `frontend/styles.css`: Styles for thinking events, visual cards, metrics, modals
- `frontend/app.js`: Handlers for all new features (metrics, cards, JSON toggle, session)
