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
