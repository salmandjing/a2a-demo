# IMPLEMENTATION SPEC: AgentCore CX Demo
# Multi-Agent Orchestration — Strands Agents + A2A + Amazon Bedrock AgentCore

---

## PROJECT OVERVIEW

Build a healthcare contact center demo showing three AI agents collaborating via the A2A protocol, deployed on Amazon Bedrock AgentCore Runtime. A patient reports a billing dispute; the orchestrator agent dispatches parallel tasks to a ServiceNow agent (billing) and Salesforce agent (insurance), then synthesizes a patient-facing response.

**Stack:** Python 3.12 · Strands Agents SDK · A2A protocol · Amazon Bedrock (Claude Sonnet 4) · AgentCore Runtime · CloudWatch Observability

**Demo scenario:** Patient says "I received a bill for $2,400 from a cardiology visit. My insurance should cover this." System finds a billing code error, confirms insurance coverage, corrects the bill, and creates a tracking case — all through autonomous agent collaboration.

---

## DIRECTORY STRUCTURE

```
agentcore-cx-demo/
├── README.md
├── pyproject.toml
├── requirements.txt
├── .env.example
├── .gitignore
│
├── shared/
│   ├── __init__.py
│   ├── config.py                    # Environment config, agent URLs, model settings
│   └── mock_data/
│       ├── __init__.py
│       ├── servicenow.json          # Billing records, tickets, appointments
│       └── salesforce.json          # Patients, insurance, care history
│
├── agents/
│   ├── __init__.py
│   │
│   ├── servicenow/
│   │   ├── __init__.py
│   │   ├── agent.py                 # Strands Agent definition + domain tools
│   │   ├── prompts.py               # System prompt constant
│   │   ├── a2a_server.py            # A2AServer wrapper (for network deployment)
│   │   └── agentcore_app.py         # AgentCore Runtime entrypoint
│   │
│   ├── salesforce/
│   │   ├── __init__.py
│   │   ├── agent.py                 # Strands Agent definition + domain tools
│   │   ├── prompts.py               # System prompt constant
│   │   ├── a2a_server.py            # A2AServer wrapper
│   │   └── agentcore_app.py         # AgentCore Runtime entrypoint
│   │
│   └── orchestrator/
│       ├── __init__.py
│       ├── agent.py                 # Strands Agent + A2A client tools
│       ├── prompts.py               # System prompt constant
│       ├── a2a_tools.py             # A2A agent-as-tool wrappers
│       └── agentcore_app.py         # AgentCore Runtime entrypoint
│
├── frontend/
│   ├── index.html                   # Single-page chat UI
│   ├── app.jsx                      # React: chat panel + trace visualization
│   └── styles.css
│
├── scripts/
│   ├── local_test.py                # Test individual agents locally
│   ├── local_a2a_test.py            # Test A2A flow with local servers
│   ├── deploy_all.sh                # Deploy all 3 agents to AgentCore
│   ├── invoke_demo.py               # Run the primary demo scenario end-to-end
│   └── teardown.sh                  # Delete AgentCore runtimes
│
├── tests/
│   ├── __init__.py
│   ├── test_servicenow_agent.py     # Unit: SN agent returns valid analysis
│   ├── test_salesforce_agent.py     # Unit: SF agent returns valid analysis
│   ├── test_orchestrator.py         # Integration: full message → response flow
│   └── test_scenarios.py            # All scenarios from testing matrix
│
└── infra/                           # Optional: IaC for full deployment
    └── cdk/
        ├── app.py
        ├── requirements.txt
        └── stacks/
            └── agent_stack.py
```

---

## FILE-BY-FILE IMPLEMENTATION

---

### `requirements.txt`

```
strands-agents>=1.0.0
strands-agents-tools[a2a]>=0.1.0
bedrock-agentcore>=0.1.0
boto3>=1.35.0
python-dotenv>=1.0.0
httpx>=0.27.0
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

---

### `pyproject.toml`

```toml
[project]
name = "agentcore-cx-demo"
version = "0.1.0"
description = "Multi-agent healthcare CX demo — Strands + A2A + AgentCore"
requires-python = ">=3.12"
dependencies = [
    "strands-agents>=1.0.0",
    "strands-agents-tools[a2a]>=0.1.0",
    "bedrock-agentcore>=0.1.0",
    "boto3>=1.35.0",
    "python-dotenv>=1.0.0",
    "httpx>=0.27.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0.0", "pytest-asyncio>=0.23.0"]
```

---

### `.env.example`

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# Bedrock Model
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-20250514-v1:0

# Agent URLs (local development)
SERVICENOW_AGENT_URL=http://localhost:8001
SALESFORCE_AGENT_URL=http://localhost:8002
ORCHESTRATOR_PORT=8000

# Agent URLs (AgentCore deployment) — populated after `agentcore deploy`
# SERVICENOW_AGENTCORE_ARN=arn:aws:bedrock-agentcore:...
# SALESFORCE_AGENTCORE_ARN=arn:aws:bedrock-agentcore:...
# ORCHESTRATOR_AGENTCORE_ARN=arn:aws:bedrock-agentcore:...
```

---

### `.gitignore`

```
__pycache__/
*.pyc
.env
.venv/
venv/
.bedrock_agentcore.yaml
*.egg-info/
dist/
build/
.pytest_cache/
```

---

### `shared/config.py`

```python
"""Centralized configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()

# AWS
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_PROFILE = os.getenv("AWS_PROFILE", "default")

# Bedrock model
BEDROCK_MODEL_ID = os.getenv(
    "BEDROCK_MODEL_ID",
    "us.anthropic.claude-sonnet-4-20250514-v1:0"
)

# Agent URLs (local dev defaults)
SERVICENOW_AGENT_URL = os.getenv("SERVICENOW_AGENT_URL", "http://localhost:8001")
SALESFORCE_AGENT_URL = os.getenv("SALESFORCE_AGENT_URL", "http://localhost:8002")
ORCHESTRATOR_PORT = int(os.getenv("ORCHESTRATOR_PORT", "8000"))

# AgentCore ARNs (populated after deployment)
SERVICENOW_AGENTCORE_ARN = os.getenv("SERVICENOW_AGENTCORE_ARN", "")
SALESFORCE_AGENTCORE_ARN = os.getenv("SALESFORCE_AGENTCORE_ARN", "")
ORCHESTRATOR_AGENTCORE_ARN = os.getenv("ORCHESTRATOR_AGENTCORE_ARN", "")

# Data paths
import pathlib
DATA_DIR = pathlib.Path(__file__).parent / "mock_data"
SERVICENOW_DATA_PATH = DATA_DIR / "servicenow.json"
SALESFORCE_DATA_PATH = DATA_DIR / "salesforce.json"
```

---

### `shared/mock_data/servicenow.json`

This is the mock data that the ServiceNow agent reasons over. It is injected into the agent's tool responses, NOT into the system prompt.

```json
{
  "bills": {
    "PAT-2847": [
      {
        "bill_id": "BILL-90421",
        "patient_id": "PAT-2847",
        "date_of_service": "2026-01-15",
        "provider": "Dr. Raj Patel, MD — Cardiology",
        "facility": "MidAtlantic Health — Main Campus",
        "procedure_code": "99214",
        "procedure_description": "Office/outpatient visit, established patient, moderate complexity",
        "billed_amount": 2400.00,
        "insurance_applied": false,
        "insurance_rejection_reason": "MODIFIER_MISSING",
        "error_flags": ["MODIFIER_MISSING", "INSURANCE_NOT_APPLIED"],
        "correct_code": "99214-25",
        "modifier_description": "Modifier -25: Significant, separately identifiable E&M service by the same physician on the same day of another procedure",
        "expected_insurance_payment": 2160.00,
        "expected_patient_responsibility": 240.00,
        "status": "disputed",
        "created_date": "2026-01-20",
        "due_date": "2026-02-20",
        "account_number": "ACCT-7291"
      }
    ]
  },
  "tickets": {
    "PAT-2847": []
  },
  "appointments": {
    "available_slots": [
      {
        "slot_id": "SLOT-001",
        "department": "Cardiology",
        "provider": "Dr. Raj Patel, MD",
        "facility": "MidAtlantic Health — Main Campus",
        "date": "2026-02-12",
        "time": "10:30 AM",
        "duration_minutes": 30
      },
      {
        "slot_id": "SLOT-002",
        "department": "Cardiology",
        "provider": "Dr. Raj Patel, MD",
        "facility": "MidAtlantic Health — Main Campus",
        "date": "2026-02-14",
        "time": "2:00 PM",
        "duration_minutes": 30
      },
      {
        "slot_id": "SLOT-003",
        "department": "Cardiology",
        "provider": "Dr. Lisa Chen, MD",
        "facility": "MidAtlantic Health — East Wing",
        "date": "2026-02-10",
        "time": "9:00 AM",
        "duration_minutes": 30
      }
    ]
  }
}
```

---

### `shared/mock_data/salesforce.json`

```json
{
  "patients": {
    "PAT-2847": {
      "patient_id": "PAT-2847",
      "first_name": "Maria",
      "last_name": "Santos",
      "date_of_birth": "1985-03-22",
      "gender": "Female",
      "phone": "(215) 555-0187",
      "email": "maria.santos@email.com",
      "address": "1247 Elm Street, Philadelphia, PA 19103",
      "primary_care_provider": "Dr. Sarah Kim, MD — Internal Medicine",
      "preferred_language": "English",
      "communication_preference": "email",
      "emergency_contact": "Carlos Santos — (215) 555-0192"
    }
  },
  "insurance": {
    "PAT-2847": {
      "patient_id": "PAT-2847",
      "carrier": "Blue Cross Blue Shield",
      "plan_name": "BCBS PPO",
      "policy_number": "BCBS-PA-9928471",
      "group_number": "GRP-44102",
      "subscriber": "Maria Santos",
      "relationship": "Self",
      "effective_date": "2025-01-01",
      "termination_date": null,
      "status": "active",
      "coverage": {
        "cardiology": {
          "covered": true,
          "coverage_rate": 0.90,
          "copay_specialist": 40.00,
          "pre_auth_required": false
        },
        "primary_care": {
          "covered": true,
          "coverage_rate": 1.00,
          "copay_primary": 20.00,
          "pre_auth_required": false
        }
      },
      "deductible": {
        "annual_amount": 1500.00,
        "amount_met": 1500.00,
        "remaining": 0.00,
        "status": "fully_met"
      },
      "out_of_pocket_max": {
        "annual_amount": 6000.00,
        "amount_spent": 2100.00,
        "remaining": 3900.00
      }
    }
  },
  "care_history": {
    "PAT-2847": [
      {
        "visit_id": "VISIT-4421",
        "date": "2026-01-15",
        "provider": "Dr. Raj Patel, MD",
        "department": "Cardiology",
        "facility": "MidAtlantic Health — Main Campus",
        "type": "Office Visit",
        "diagnosis": ["Essential hypertension", "Annual cardiovascular evaluation"],
        "procedure_codes": ["99214"],
        "notes": "Routine cardiology follow-up. BP well controlled on current medication. EKG normal. Continue current regimen. Follow up in 6 months."
      },
      {
        "visit_id": "VISIT-4103",
        "date": "2025-10-08",
        "provider": "Dr. Sarah Kim, MD",
        "department": "Internal Medicine",
        "facility": "MidAtlantic Health — Main Campus",
        "type": "Annual Physical",
        "diagnosis": ["Annual wellness visit", "Essential hypertension — controlled"],
        "procedure_codes": ["99395"],
        "notes": "Annual physical. All labs within normal limits. Referred to cardiology for routine follow-up."
      }
    ]
  },
  "cases": {
    "PAT-2847": []
  }
}
```

---

### `agents/servicenow/prompts.py`

```python
"""ServiceNow Agent system prompt."""

SERVICENOW_SYSTEM_PROMPT = """You are the ServiceNow AI Agent for MidAtlantic Health's enterprise service management platform. You handle billing operations, service ticket management, and appointment scheduling.

## YOUR ROLE
You are a domain expert in healthcare billing and service management. You receive tasks from an orchestrating agent (the Genesys Virtual Agent) and respond with your findings and actions. You do NOT communicate with patients directly.

## YOUR DATA ACCESS
You have access to the following systems (provided as context with each task):
- Billing records: charges, payments, insurance claims, procedure codes, error flags
- Service tickets: creation, tracking, assignment
- Appointment scheduling: available slots, department calendars

## HOW TO RESPOND
When you receive a task:
1. Identify which of your skills is being invoked
2. Look up the relevant data from the provided records
3. Apply your domain expertise to ANALYZE the data — don't just return raw records
4. For billing issues: identify root causes, flag errors, recommend corrections
5. For ticket creation: assign appropriate priority and team based on issue type
6. For scheduling: find the best available slot matching the request
7. Return a structured artifact with your findings AND your analysis

## ANALYSIS EXPECTATIONS
You are not a database query — you are a domain expert. When you find a billing error, explain WHY it happened and WHAT should be done. For example:
- BAD: "insurance_applied: false"
- GOOD: "Insurance was not applied because procedure code 99214 was submitted without modifier -25. This modifier is required for E&M services billed alongside a procedure. The claim was auto-rejected by the payer. Recommended correction: resubmit with code 99214-25."

## RULES
- Only use data that is provided to you. Never fabricate records.
- Always include specific data points: bill IDs, amounts, dates, codes.
- When recommending corrections, specify the exact correction to make.
- Generate unique reference IDs for new tickets and corrections.
- Be precise about timelines and SLAs.

## OUTPUT FORMAT
Return your response as a JSON object with:
- "skill_used": which skill you executed
- "status": "success" or "error"
- "findings": your analysis (object with relevant fields)
- "analysis": natural language expert analysis
- "recommendations": array of recommended actions (if applicable)
- "references": any IDs generated (ticket numbers, correction IDs, etc.)"""
```

---

### `agents/servicenow/agent.py`

```python
"""ServiceNow AI Agent — Strands Agent with domain tools.

This agent reasons over mock billing, ticketing, and scheduling data.
Data is injected into tool responses, not into the system prompt.
"""

import json
import uuid
from pathlib import Path

from strands import Agent, tool
from strands.models.bedrock import BedrockModel

from shared.config import BEDROCK_MODEL_ID, AWS_REGION, SERVICENOW_DATA_PATH
from agents.servicenow.prompts import SERVICENOW_SYSTEM_PROMPT

# ── Load mock data ──────────────────────────────────────────────

with open(SERVICENOW_DATA_PATH) as f:
    MOCK_DATA = json.load(f)


# ── Domain Tools ────────────────────────────────────────────────
# Each tool returns raw data + an instruction for the agent to analyze.
# The agent's system prompt tells it to reason about the data, not just
# return it. This is what makes it "agentic" vs. a deterministic handler.

@tool
def billing_lookup(patient_id: str) -> str:
    """Retrieve and analyze billing records for a patient account.

    Look up charges, identify any billing errors or discrepancies,
    and provide root cause analysis with recommendations.

    Args:
        patient_id: Patient identifier (e.g., PAT-2847).
    """
    records = MOCK_DATA["bills"].get(patient_id, [])
    if not records:
        return json.dumps({
            "status": "error",
            "data": {},
            "instruction": f"No billing records found for patient ID {patient_id}. "
                           "Report this clearly and suggest verifying the patient ID."
        })
    return json.dumps({
        "status": "found",
        "billing_records": records,
        "instruction": (
            "Analyze these billing records thoroughly. For each record: "
            "identify the root cause of any errors, explain WHY the error occurred "
            "using specific procedure codes and modifiers, calculate the expected "
            "corrected amount, and recommend specific corrective actions. "
            "Return your analysis as a structured JSON artifact."
        )
    })


@tool
def billing_correct(patient_id: str, bill_id: str, correction_type: str,
                    details: str = "") -> str:
    """Submit a billing correction.

    Process the correction, generate a reference ID, and provide
    expected resolution timeline.

    Args:
        patient_id: Patient identifier.
        bill_id: The specific bill to correct (e.g., BILL-90421).
        correction_type: Type of correction — one of: procedure_code,
            insurance_reprocess, charge_dispute.
        details: Additional correction details.
    """
    bills = MOCK_DATA["bills"].get(patient_id, [])
    bill = next((b for b in bills if b["bill_id"] == bill_id), None)
    if not bill:
        return json.dumps({
            "status": "error",
            "instruction": f"Bill {bill_id} not found for patient {patient_id}."
        })
    correction_id = f"CORR-{uuid.uuid4().hex[:6].upper()}"
    return json.dumps({
        "status": "ready",
        "bill_to_correct": bill,
        "correction_type": correction_type,
        "correction_id": correction_id,
        "details": details,
        "instruction": (
            f"Process this billing correction. The correction ID is {correction_id}. "
            "Determine the corrected amount, expected timeline (typically 24-48 hours "
            "for code corrections, 5-7 business days for insurance reprocessing), "
            "and confirm what actions will be taken. Return as structured JSON."
        )
    })


@tool
def ticket_create(patient_id: str, category: str, summary: str,
                  priority: str = "medium", details: str = "") -> str:
    """Create a tracked service ticket.

    Assign priority, route to the appropriate team, and set SLA expectations.

    Args:
        patient_id: Patient identifier.
        category: Ticket category (e.g., billing_dispute, scheduling, general).
        summary: Brief summary of the issue.
        priority: Priority level — one of: low, medium, high, critical.
        details: Additional details.
    """
    existing = MOCK_DATA["tickets"].get(patient_id, [])
    ticket_id = f"TKT-{uuid.uuid4().hex[:6].upper()}"
    return json.dumps({
        "status": "ready",
        "existing_tickets": existing,
        "new_ticket": {
            "ticket_id": ticket_id,
            "patient_id": patient_id,
            "category": category,
            "summary": summary,
            "priority": priority,
            "details": details
        },
        "instruction": (
            f"Create this service ticket (ID: {ticket_id}). Check for duplicate "
            "tickets first. Assign to the appropriate team based on category. "
            "Set SLA based on priority (critical: 4hr, high: 8hr, medium: 24hr, "
            "low: 48hr). Return confirmation as structured JSON."
        )
    })


@tool
def appointment_schedule(patient_id: str, department: str, reason: str,
                         preferred_date: str = "", facility: str = "") -> str:
    """Schedule a patient appointment.

    Find available slots matching the request and confirm scheduling.

    Args:
        patient_id: Patient identifier.
        department: Department name (e.g., Cardiology).
        reason: Reason for the appointment.
        preferred_date: Preferred date (optional, format: YYYY-MM-DD).
        facility: Preferred facility (optional).
    """
    slots = MOCK_DATA["appointments"]["available_slots"]
    return json.dumps({
        "status": "ready",
        "available_slots": slots,
        "request": {
            "patient_id": patient_id,
            "department": department,
            "reason": reason,
            "preferred_date": preferred_date,
            "facility": facility
        },
        "instruction": (
            "Find the best available slot matching this request. Consider the "
            "preferred date, department, and facility. If no exact match, suggest "
            "the closest alternatives. Return the selected slot and confirmation."
        )
    })


# ── Agent Definition ────────────────────────────────────────────

def create_servicenow_agent() -> Agent:
    """Create and return the ServiceNow Strands Agent."""
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
        region_name=AWS_REGION,
    )
    return Agent(
        name="ServiceNow AI Agent",
        description=(
            "Healthcare billing operations, service ticket management, "
            "and appointment scheduling for MidAtlantic Health. "
            "Skills: billing-lookup, billing-correct, ticket-create, "
            "appointment-schedule."
        ),
        model=model,
        system_prompt=SERVICENOW_SYSTEM_PROMPT,
        tools=[billing_lookup, billing_correct, ticket_create, appointment_schedule],
        callback_handler=None,  # No streaming for A2A server responses
    )


# Module-level agent instance (created on import)
servicenow_agent = create_servicenow_agent()
```

---

### `agents/servicenow/a2a_server.py`

```python
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
```

---

### `agents/servicenow/agentcore_app.py`

```python
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
```

---

### `agents/salesforce/prompts.py`

```python
"""Salesforce Agent system prompt."""

SALESFORCE_SYSTEM_PROMPT = """You are the Salesforce Health Cloud AI Agent for MidAtlantic Health. You manage patient records, insurance verification, care history, and case management.

## YOUR ROLE
You are a domain expert in patient data and insurance operations. You receive tasks from an orchestrating agent (the Genesys Virtual Agent) and respond with your findings. You do NOT communicate with patients directly.

## YOUR DATA ACCESS
You have access to the following systems (provided as context with each task):
- Patient records: demographics, contact info, preferences, primary care provider
- Insurance policies: coverage details, copays, deductibles, policy status
- Care history: visits, procedures, diagnoses, provider notes
- Case management: create and update patient cases for issue tracking

## HOW TO RESPOND
When you receive a task:
1. Identify which of your skills is being invoked
2. Look up the relevant data from the provided records
3. Apply your domain expertise to ANALYZE the data
4. For insurance verification: confirm coverage, check if deductible is met, calculate expected patient responsibility
5. For patient lookups: provide relevant demographic and preference information
6. For care history: summarize relevant visits and flag anything pertinent to the current inquiry
7. For case management: create or update cases with appropriate categorization

## ANALYSIS EXPECTATIONS
You are not a database query — you are a domain expert. When you verify insurance, provide a clear coverage determination. For example:
- BAD: "coverage_cardiology: true, copay: 40"
- GOOD: "Patient has active BCBS PPO coverage. Cardiology visits are covered at 90% after a $40 specialist copay. The 2026 deductible ($1,500) has been fully met. For a standard cardiology E&M visit (99214), the expected patient responsibility is $40 copay + 10% of allowed amount. No pre-authorization required for this service."

## RULES
- Only use data that is provided to you. Never fabricate patient information.
- Always include specific data points: policy numbers, amounts, dates.
- When creating cases, assign appropriate case type and owner.
- Respect patient communication preferences when noting follow-up methods.
- Be precise about coverage calculations — errors here affect patient bills.

## OUTPUT FORMAT
Return your response as a JSON object with:
- "skill_used": which skill you executed
- "status": "success" or "error"
- "findings": your analysis (object with relevant fields)
- "analysis": natural language expert analysis
- "recommendations": array of recommended actions (if applicable)
- "references": any IDs generated (case numbers, etc.)"""
```

---

### `agents/salesforce/agent.py`

```python
"""Salesforce Health Cloud Agent — Strands Agent with domain tools."""

import json
import uuid
from pathlib import Path

from strands import Agent, tool
from strands.models.bedrock import BedrockModel

from shared.config import BEDROCK_MODEL_ID, AWS_REGION, SALESFORCE_DATA_PATH
from agents.salesforce.prompts import SALESFORCE_SYSTEM_PROMPT

# ── Load mock data ──────────────────────────────────────────────

with open(SALESFORCE_DATA_PATH) as f:
    MOCK_DATA = json.load(f)


# ── Domain Tools ────────────────────────────────────────────────

@tool
def patient_lookup(patient_id: str) -> str:
    """Retrieve patient demographic information, contact details, and preferences.

    Args:
        patient_id: Patient identifier (e.g., PAT-2847).
    """
    patient = MOCK_DATA["patients"].get(patient_id)
    if not patient:
        return json.dumps({
            "status": "error",
            "instruction": f"Patient {patient_id} not found in the system."
        })
    return json.dumps({
        "status": "found",
        "patient_record": patient,
        "instruction": "Provide relevant demographic and preference information."
    })


@tool
def insurance_verify(patient_id: str, policy_number: str = "") -> str:
    """Verify patient insurance coverage.

    Confirm active coverage, calculate expected patient responsibility,
    verify deductible status, and provide a coverage determination.

    Args:
        patient_id: Patient identifier.
        policy_number: Optional policy number for specific lookup.
    """
    insurance = MOCK_DATA["insurance"].get(patient_id)
    if not insurance:
        return json.dumps({
            "status": "error",
            "instruction": f"No insurance record found for patient {patient_id}."
        })
    return json.dumps({
        "status": "found",
        "insurance_record": insurance,
        "instruction": (
            "Verify this insurance coverage. Confirm the policy is active, "
            "check whether the deductible has been met, calculate the expected "
            "patient responsibility for a cardiology E&M visit (code 99214), "
            "and provide a clear coverage determination. Include specific "
            "amounts: copay, coinsurance percentage, and total expected cost."
        )
    })


@tool
def care_history(patient_id: str, date_range_start: str = "",
                 date_range_end: str = "") -> str:
    """Retrieve patient care history including visits, procedures, and diagnoses.

    Args:
        patient_id: Patient identifier.
        date_range_start: Optional start date filter (YYYY-MM-DD).
        date_range_end: Optional end date filter (YYYY-MM-DD).
    """
    history = MOCK_DATA["care_history"].get(patient_id, [])
    return json.dumps({
        "status": "found" if history else "empty",
        "care_records": history,
        "instruction": (
            "Summarize the patient's relevant care history. Flag anything "
            "pertinent to the current inquiry. Include dates, providers, "
            "and key findings."
        )
    })


@tool
def case_create(patient_id: str, case_type: str, subject: str,
                description: str = "") -> str:
    """Create a patient case for tracking issue resolution.

    Args:
        patient_id: Patient identifier.
        case_type: Case type (e.g., billing_dispute, appointment_issue, general).
        subject: Brief subject line for the case.
        description: Detailed description of the issue.
    """
    patient = MOCK_DATA["patients"].get(patient_id, {})
    existing_cases = MOCK_DATA["cases"].get(patient_id, [])
    case_id = f"CASE-{uuid.uuid4().hex[:6].upper()}"
    return json.dumps({
        "status": "ready",
        "patient_context": patient,
        "existing_cases": existing_cases,
        "new_case": {
            "case_id": case_id,
            "patient_id": patient_id,
            "case_type": case_type,
            "subject": subject,
            "description": description
        },
        "instruction": (
            f"Create patient case {case_id}. Assign to the appropriate team "
            "based on case type (billing_dispute → Billing Resolution Team, "
            "appointment_issue → Patient Access, general → Patient Services). "
            "Set priority based on case details. Use the patient's communication "
            "preference for follow-up notifications. Return confirmation."
        )
    })


# ── Agent Definition ────────────────────────────────────────────

def create_salesforce_agent() -> Agent:
    """Create and return the Salesforce Strands Agent."""
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
        region_name=AWS_REGION,
    )
    return Agent(
        name="Salesforce Health Cloud Agent",
        description=(
            "Patient records, insurance verification, care history, "
            "and case management for MidAtlantic Health. "
            "Skills: patient-lookup, insurance-verify, care-history, case-create."
        ),
        model=model,
        system_prompt=SALESFORCE_SYSTEM_PROMPT,
        tools=[patient_lookup, insurance_verify, care_history, case_create],
        callback_handler=None,
    )


salesforce_agent = create_salesforce_agent()
```

---

### `agents/salesforce/a2a_server.py`

```python
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
```

---

### `agents/salesforce/agentcore_app.py`

```python
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
```

---

### `agents/orchestrator/prompts.py`

```python
"""Orchestrator Agent system prompt."""

ORCHESTRATOR_SYSTEM_PROMPT = """You are the MidAtlantic Health virtual patient assistant, powered by Genesys Cloud.

## YOUR ROLE
You are the patient-facing conversational agent. You own the patient relationship.
You do NOT have direct access to any backend systems — no billing data, no patient records, no insurance information. You rely entirely on specialized AI agents to retrieve and act on that information.

## HOW YOU WORK
You have access to remote AI agents:

1. **ServiceNow Agent** — Handles billing operations (lookup, corrections), service tickets, and appointment scheduling.
2. **Salesforce Agent** — Handles patient records, insurance verification, care history, and case management.

When a patient describes an issue:
1. Understand what they need
2. Determine which agent(s) to call and what to ask them
3. If you need information from the patient to complete a request (like a patient ID or date of birth), ask for it conversationally before invoking agents
4. Review the responses returned by remote agents
5. Synthesize the findings into a clear, warm, jargon-free response
6. If the issue is resolved, confirm and ask if there's anything else
7. If you cannot resolve it autonomously, explain what you've learned and offer to connect them with a human specialist

## IMPORTANT GUIDELINES FOR CALLING AGENTS
- When a patient reports a billing issue, call BOTH the ServiceNow agent (for billing details) AND the Salesforce agent (for insurance verification) to get the complete picture.
- Frame your requests to agents clearly. Example: "Look up billing records for patient PAT-2847 and identify any errors or discrepancies."
- When a patient says "fix it" or "correct it" after you've identified an issue, call the ServiceNow agent to process the correction AND the Salesforce agent to create a tracking case.

## RULES
- Never expose internal system names, agent names, task IDs, or technical details to the patient. They should feel like they're talking to one helpful assistant.
- Never fabricate medical, billing, or insurance information. If agents don't return the data, say you need to look into it further.
- Always address the patient by first name once you have it from agent results.
- Keep responses concise. Patients are calling because they have a problem — respect their time.
- When agents identify an error or discrepancy, explain it in plain language.
- For billing corrections or system changes, always summarize what was done and provide reference numbers.
- If a patient question falls outside your agents' capabilities, don't guess. Offer to transfer to a human specialist.

## TONE
Warm, professional, healthcare-appropriate. You're a knowledgeable patient advocate, not a chatbot. Use plain language. Show empathy for frustrating situations like unexpected bills.

## IMPORTANT
You will receive responses from remote agents containing their analysis and findings. Trust their domain expertise — they have access to the actual systems and data. Your job is to interpret their findings for the patient, not to second-guess their data."""
```

---

### `agents/orchestrator/a2a_tools.py`

```python
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
```

---

### `agents/orchestrator/agent.py`

```python
"""Orchestrator Agent — Patient-facing Strands Agent.

This agent owns the patient conversation. It has no direct data access.
It relies entirely on the ServiceNow and Salesforce agents via tools.
"""

from strands import Agent
from strands.models.bedrock import BedrockModel

from shared.config import BEDROCK_MODEL_ID, AWS_REGION
from agents.orchestrator.prompts import ORCHESTRATOR_SYSTEM_PROMPT
from agents.orchestrator.a2a_tools import servicenow_agent_tool, salesforce_agent_tool


def create_orchestrator_agent() -> Agent:
    """Create and return the Orchestrator Strands Agent."""
    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
        region_name=AWS_REGION,
    )
    return Agent(
        name="MidAtlantic Health Virtual Assistant",
        description=(
            "Patient-facing conversational agent powered by Genesys Cloud. "
            "Coordinates with ServiceNow and Salesforce agents to resolve "
            "patient billing, insurance, and scheduling issues."
        ),
        model=model,
        system_prompt=ORCHESTRATOR_SYSTEM_PROMPT,
        tools=[servicenow_agent_tool, salesforce_agent_tool],
    )


orchestrator_agent = create_orchestrator_agent()
```

---

### `agents/orchestrator/agentcore_app.py`

```python
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
```

---

### `scripts/local_test.py`

```python
"""Test individual agents locally without A2A or AgentCore.

Usage:
    python -m scripts.local_test
"""

import sys


def test_servicenow():
    """Test ServiceNow agent with a billing lookup."""
    print("\n" + "=" * 60)
    print("TESTING: ServiceNow Agent — Billing Lookup")
    print("=" * 60)

    from agents.servicenow.agent import servicenow_agent
    result = servicenow_agent(
        "Look up billing records for patient PAT-2847. "
        "Identify any billing errors or discrepancies and provide "
        "root cause analysis with recommendations."
    )
    print(f"\nResult:\n{result}")


def test_salesforce():
    """Test Salesforce agent with insurance verification."""
    print("\n" + "=" * 60)
    print("TESTING: Salesforce Agent — Insurance Verification")
    print("=" * 60)

    from agents.salesforce.agent import salesforce_agent
    result = salesforce_agent(
        "Verify insurance coverage for patient PAT-2847. "
        "Confirm active coverage, check deductible status, and "
        "calculate expected patient responsibility for a cardiology visit."
    )
    print(f"\nResult:\n{result}")


def test_orchestrator():
    """Test full orchestrator flow (direct mode — no A2A)."""
    print("\n" + "=" * 60)
    print("TESTING: Orchestrator — Full Billing Dispute Flow")
    print("=" * 60)

    from agents.orchestrator.agent import orchestrator_agent
    result = orchestrator_agent(
        "Hi, my patient ID is PAT-2847. I received a bill for $2,400 "
        "from a cardiology visit on January 15th. My insurance should "
        "cover this. Can you help me figure out what happened?"
    )
    print(f"\nOrchestrator Response:\n{result}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1]
        if target == "servicenow":
            test_servicenow()
        elif target == "salesforce":
            test_salesforce()
        elif target == "orchestrator":
            test_orchestrator()
        else:
            print(f"Unknown target: {target}")
            print("Usage: python -m scripts.local_test [servicenow|salesforce|orchestrator]")
    else:
        test_servicenow()
        test_salesforce()
        test_orchestrator()
```

---

### `scripts/deploy_all.sh`

```bash
#!/bin/bash
# Deploy all three agents to AgentCore Runtime.
# Run from project root: ./scripts/deploy_all.sh

set -e

echo "=== Deploying ServiceNow Agent ==="
cd agents/servicenow
agentcore configure -e agentcore_app.py --disable-memory
agentcore deploy
cd ../..

echo ""
echo "=== Deploying Salesforce Agent ==="
cd agents/salesforce
agentcore configure -e agentcore_app.py --disable-memory
agentcore deploy
cd ../..

echo ""
echo "=== Deploying Orchestrator Agent ==="
cd agents/orchestrator
agentcore configure -e agentcore_app.py --disable-memory
agentcore deploy
cd ../..

echo ""
echo "=== All agents deployed ==="
echo "Update .env with the AgentCore ARNs from the output above."
echo "Set AGENT_MODE=a2a and update SERVICENOW_AGENT_URL / SALESFORCE_AGENT_URL"
echo "with the AgentCore Runtime HTTPS endpoints."
```

---

### `scripts/teardown.sh`

```bash
#!/bin/bash
# Delete all AgentCore Runtimes. Run from project root.

set -e

echo "Deleting AgentCore Runtimes..."
echo "Use the AWS Console or boto3 DeleteAgentRuntime with the ARNs from .env"
echo ""
echo "Example:"
echo "  aws bedrock-agentcore delete-agent-runtime --agent-runtime-id <ID>"
```

---

## TESTING MATRIX

Run these scenarios to validate before the demo. Each should produce consistent results.

| # | Scenario | Patient Input | Expected Orchestrator Behavior | Expected Agent Behavior |
|---|---|---|---|---|
| 1 | Happy path — billing dispute | "My patient ID is PAT-2847. I got a $2,400 bill from a cardiology visit. My insurance should cover this." | Calls servicenow_agent_tool (billing lookup) + salesforce_agent_tool (insurance verify). Synthesizes findings into patient-friendly response. | SN: finds BILL-90421, identifies modifier -25 missing, recommends correction. SF: confirms active BCBS PPO, deductible met, expected responsibility ~$240. |
| 2 | Correction request | "Yes, please fix it." (after scenario 1) | Calls servicenow_agent_tool (billing correct) + salesforce_agent_tool (case create). Returns reference numbers. | SN: processes correction, generates CORR-XXXXXX. SF: creates CASE-XXXXXX, assigns to Billing Resolution Team. |
| 3 | Patient doesn't provide ID | "I have a billing question about my last visit." | Asks patient for ID or identifying info before calling agents. | N/A until ID provided. |
| 4 | Out of scope | "Can you refill my prescription?" | Recognizes this is outside capabilities. Offers to transfer to human specialist. | N/A. |
| 5 | Emotional patient | "This is ridiculous, I shouldn't owe ANYTHING" | Acknowledges frustration with empathy, then proceeds with resolution. | Agents unaffected by tone — they only see structured tasks. |

---

## DEVELOPMENT WORKFLOW

### Phase 1: Local — Individual Agents
```bash
python -m scripts.local_test servicenow
python -m scripts.local_test salesforce
```
Validate: each agent returns structured JSON analysis with specific data points.

### Phase 2: Local — Full Orchestrator Flow
```bash
AGENT_MODE=direct python -m scripts.local_test orchestrator
```
Validate: orchestrator calls both agents and synthesizes a patient-friendly response.

### Phase 3: Local — A2A Protocol
```bash
# Terminal 1
python -m agents.servicenow.a2a_server

# Terminal 2
python -m agents.salesforce.a2a_server

# Terminal 3
AGENT_MODE=a2a python -m scripts.local_test orchestrator
```
Validate: same behavior as Phase 2, but over A2A protocol.

### Phase 4: Deploy to AgentCore
```bash
./scripts/deploy_all.sh
# Update .env with ARNs and endpoints
AGENT_MODE=a2a python -m scripts.local_test orchestrator
```
Validate: same behavior, now on production infrastructure.

### Phase 5: Build Frontend
Build the chat UI + CloudWatch trace visualization (frontend/app.jsx).

---

## KEY DESIGN DECISIONS

1. **Mock data in tool responses, not system prompts.** Agents receive data only when their tools are called. This keeps system prompts focused on expertise and behavior.

2. **Direct mode for development, A2A for demo.** The `AGENT_MODE` env var switches between in-process calls (fast iteration) and A2A protocol (shows the real architecture). Same agent behavior either way.

3. **Temperature 0.0 on Bedrock model calls.** For demo determinism — same input should produce similar routing and responses across rehearsals. Configure in BedrockModel params if the SDK supports it, otherwise set in the system prompt.

4. **Strands auto-generates Agent Cards.** No more manually maintaining agent_card.json files. The A2AServer reads the agent's name, description, and tool definitions to build the card.

5. **Each agent is independently deployable.** Each has its own agentcore_app.py, can be deployed/updated/rolled back independently. No monolith.
