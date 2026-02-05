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
