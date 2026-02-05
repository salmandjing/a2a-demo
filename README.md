# Agent 2 Agent Healthcare Demo

A demonstration of **multi-agent AI orchestration** for healthcare customer experience. Three specialized AI agents collaborate in real-time to resolve patient billing disputes, verify insurance, and manage cases.

![Demo Screenshot](https://img.shields.io/badge/status-working-brightgreen) ![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue) ![License MIT](https://img.shields.io/badge/license-MIT-green)

## The Demo Scenario

> **Patient:** "I received a $2,400 bill for my cardiology visit. My insurance should cover this."

Watch as three AI agents collaborate autonomously:

1. **Orchestrator** receives the patient message and coordinates the investigation
2. **ServiceNow Agent** discovers a billing code error (missing modifier -25)
3. **Salesforce Agent** confirms active insurance with 90% coverage
4. **Orchestrator** synthesizes findings and initiates correction
5. Patient receives a clear explanation and tracking reference

**Total resolution time:** ~8 seconds

## Architecture

```
                         ┌─────────────────┐
                         │     Patient     │
                         └────────┬────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │    Orchestrator Agent   │
                    │   (Patient-facing AI)   │
                    │                         │
                    │  • Owns conversation    │
                    │  • No direct data access│
                    │  • Synthesizes responses│
                    └─────────┬───────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │ ServiceNow Agent│             │ Salesforce Agent│
    │                 │             │                 │
    │ • Billing ops   │             │ • Patient data  │
    │ • Tickets       │             │ • Insurance     │
    │ • Scheduling    │             │ • Care history  │
    └─────────────────┘             └─────────────────┘
```

## Key Features

**Real-time Agent Tracing** — Watch agent activity as it happens with SSE streaming. See which agent is working, what tools they're calling, and the data they discover.

**Visual Data Cards** — Rich UI cards display billing errors, insurance coverage, corrections, and case details as they're found.

**Conversation Memory** — Multi-turn conversations with context persistence. The system remembers the patient across messages.

**Performance Metrics** — Live display of response time, token usage, and cost estimates.

## Tech Stack

- **Agents:** [Strands Agents SDK](https://github.com/strands-agents/strands-agents-python) with Claude Sonnet 4 on Amazon Bedrock
- **Protocol:** [A2A (Agent-to-Agent)](https://github.com/google/a2a) for cross-platform agent communication
- **Backend:** FastAPI with Server-Sent Events for real-time streaming
- **Frontend:** Vanilla JS with a dark mode UI
- **Deployment:** Ready for [Amazon Bedrock AgentCore Runtime](https://aws.amazon.com/bedrock/agentcore/)

## Quick Start

### Prerequisites

- Python 3.12+
- AWS account with Bedrock access (Claude Sonnet 4 enabled)
- AWS credentials configured (`aws configure`)

### Setup

```bash
# Clone the repo
git clone https://github.com/salmandjing/a2a-demo.git
cd a2a-demo

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your AWS region if needed
```

### Run the Demo

```bash
# Start the server
python server.py

# Open in browser
open http://localhost:8000
```

Click **"Start: Billing Dispute"** to run the full demo scenario.

## Project Structure

```
a2a-demo/
├── agents/
│   ├── orchestrator/     # Patient-facing agent
│   ├── servicenow/       # Billing & ticketing agent
│   └── salesforce/       # Patient data & insurance agent
├── shared/
│   ├── config.py         # Environment configuration
│   └── mock_data/        # Simulated backend data
├── frontend/
│   ├── index.html        # Chat UI
│   ├── styles.css        # Dark theme styling
│   └── app.js            # Real-time trace handling
├── server.py             # FastAPI backend with SSE
└── docs/
    └── ARCHITECTURE.md   # Detailed architecture docs
```

## How It Works

### Agent Communication

The orchestrator doesn't have direct access to any data. When a patient asks about billing:

1. Orchestrator calls `servicenow_agent_tool("Look up billing for PAT-2847...")`
2. ServiceNow agent queries mock data, analyzes the billing record, identifies the error
3. ServiceNow returns structured findings with root cause analysis
4. Orchestrator simultaneously calls `salesforce_agent_tool("Verify insurance...")`
5. Salesforce agent confirms coverage and calculates expected patient responsibility
6. Orchestrator synthesizes both responses into a patient-friendly message

### Data Injection Pattern

Mock data is injected into **tool responses**, not system prompts. This keeps agents focused on reasoning rather than memorizing data:

```python
@tool
def billing_lookup(patient_id: str) -> str:
    records = MOCK_DATA["bills"].get(patient_id, [])
    return json.dumps({
        "billing_records": records,
        "instruction": "Analyze these records. Identify errors..."
    })
```

### Two Execution Modes

- **Direct Mode** (default): Agents run in-process for fast local development
- **A2A Mode**: Agents communicate via A2A protocol over HTTP for production deployment

Toggle with `AGENT_MODE=a2a` in your `.env` file.

## Testing Individual Agents

```bash
# Test ServiceNow agent
python -m scripts.local_test servicenow

# Test Salesforce agent
python -m scripts.local_test salesforce

# Test full orchestrator flow
python -m scripts.local_test orchestrator
```

## Deployment to AWS

Deploy all three agents to Amazon Bedrock AgentCore Runtime:

```bash
./scripts/deploy_all.sh
```

Then update `.env` with the AgentCore ARNs and set `AGENT_MODE=a2a`.

## License

MIT

---

Built with [Strands Agents](https://github.com/strands-agents/strands-agents-python) and [Amazon Bedrock](https://aws.amazon.com/bedrock/)
