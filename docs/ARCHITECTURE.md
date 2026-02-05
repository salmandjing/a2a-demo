# Architecture

## Overview

Multi-agent healthcare contact center demo showing three AI agents collaborating via the A2A protocol, deployable on Amazon Bedrock AgentCore Runtime.

**Demo scenario:** Patient reports $2,400 billing dispute → Orchestrator dispatches parallel tasks to ServiceNow (billing) and Salesforce (insurance) agents → Agents discover billing code error and confirm coverage → Correction processed and tracking case created.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Patient                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                            │
│            (Patient-facing virtual assistant)                    │
│                                                                  │
│  - Owns patient conversation                                     │
│  - No direct data access                                         │
│  - Synthesizes agent responses into patient-friendly language    │
└─────────────────────────────────────────────────────────────────┘
                    │                       │
                    ▼                       ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│     ServiceNow Agent         │  │     Salesforce Agent         │
│                              │  │                              │
│  - Billing lookup/correct    │  │  - Patient records           │
│  - Service tickets           │  │  - Insurance verification    │
│  - Appointment scheduling    │  │  - Care history              │
│                              │  │  - Case management           │
└──────────────────────────────┘  └──────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│   Mock ServiceNow Data       │  │   Mock Salesforce Data       │
│   (servicenow.json)          │  │   (salesforce.json)          │
└──────────────────────────────┘  └──────────────────────────────┘
```

---

## Key Patterns

### 1. Data in Tool Responses, Not System Prompts
Mock data is injected when tools are called, not loaded into agent system prompts. This keeps prompts focused on expertise and behavior.

### 2. Direct Mode vs A2A Mode
`AGENT_MODE` env var switches between:
- `direct` (default): In-process agent calls for fast local development
- `a2a`: Real A2A protocol over network for demo/production

### 3. Agents as Tools
The orchestrator treats remote agents as tools with natural language interfaces. Each tool wraps an agent call and returns the agent's response.

### 4. Independent Deployability
Each agent has its own `agentcore_app.py` entrypoint. Can be deployed, updated, or rolled back independently.

---

## Directory Structure

```
a2a-demo/
├── CLAUDE.md                     # Project rules for Claude
├── pyproject.toml                # Python project config
├── requirements.txt              # Dependencies
├── .env.example                  # Environment template
├── .gitignore
├── spec.md                       # Implementation specification
│
├── shared/
│   ├── __init__.py
│   ├── config.py                 # Centralized env config
│   └── mock_data/
│       ├── servicenow.json       # Billing, tickets, appointments
│       └── salesforce.json       # Patients, insurance, care history
│
├── agents/
│   ├── servicenow/
│   │   ├── agent.py              # Strands Agent + domain tools
│   │   ├── prompts.py            # System prompt
│   │   ├── a2a_server.py         # A2A server (port 8001)
│   │   └── agentcore_app.py      # AgentCore entrypoint
│   │
│   ├── salesforce/
│   │   ├── agent.py              # Strands Agent + domain tools
│   │   ├── prompts.py            # System prompt
│   │   ├── a2a_server.py         # A2A server (port 8002)
│   │   └── agentcore_app.py      # AgentCore entrypoint
│   │
│   └── orchestrator/
│       ├── agent.py              # Strands Agent
│       ├── prompts.py            # System prompt
│       ├── a2a_tools.py          # Agent-as-tool wrappers
│       └── agentcore_app.py      # AgentCore entrypoint
│
├── scripts/
│   ├── local_test.py             # Test agents locally
│   ├── deploy_all.sh             # Deploy to AgentCore
│   └── teardown.sh               # Delete runtimes
│
├── docs/
│   ├── WHAT_IS_BUILT.md          # Feature/change log
│   ├── PROGRESS.md               # Next steps & tech debt
│   └── ARCHITECTURE.md           # This file
│
├── frontend/                     # (To be built)
│   ├── index.html
│   ├── app.jsx
│   └── styles.css
│
└── tests/                        # (To be built)
    ├── test_servicenow_agent.py
    ├── test_salesforce_agent.py
    └── test_orchestrator.py
```

---

## Design Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Progressive docs in `/docs` | Keeps documentation organized and separate from code | 2026-02-04 |
| Mock data in JSON files | Easy to read/modify, simulates real system responses | 2026-02-04 |
| AGENT_MODE env var for switching | Same code path for dev (direct) and demo (A2A) | 2026-02-04 |
| Strands Agents SDK | Auto-generates A2A Agent Cards from agent definition | 2026-02-04 |
| Tools return JSON with instructions | Guides agent reasoning while keeping data structured | 2026-02-04 |
| Claude Sonnet 4 on Bedrock | Balance of capability and cost for multi-agent demo | 2026-02-04 |
