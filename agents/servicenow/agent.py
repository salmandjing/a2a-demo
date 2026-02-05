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
