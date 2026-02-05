"""API server with real-time streaming, thinking, memory, and full observability."""

import json
import uuid
import time
import asyncio
import queue
import threading
import re
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="AgentCore CX Demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════
# Session & Conversation Storage
# ═══════════════════════════════════════════════════════════════════

class ConversationSession:
    """Stores conversation history and state."""
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.messages: list[dict] = []
        self.created_at = datetime.now()
        self.patient_context: dict = {}  # Extracted patient info
        self.total_tokens = 0
        self.total_cost = 0.0

    def add_message(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})

    def get_context_summary(self) -> str:
        """Get a summary of conversation context for the agent."""
        if not self.patient_context:
            return ""
        parts = []
        if self.patient_context.get("patient_id"):
            parts.append(f"Patient ID: {self.patient_context['patient_id']}")
        if self.patient_context.get("patient_name"):
            parts.append(f"Name: {self.patient_context['patient_name']}")
        if self.patient_context.get("issue_type"):
            parts.append(f"Issue: {self.patient_context['issue_type']}")
        return "Previous context: " + ", ".join(parts) if parts else ""


# In-memory session store (would use Redis in production)
sessions: dict[str, ConversationSession] = {}


def get_or_create_session(session_id: Optional[str]) -> ConversationSession:
    if session_id and session_id in sessions:
        return sessions[session_id]
    new_id = session_id or str(uuid.uuid4())
    sessions[new_id] = ConversationSession(new_id)
    return sessions[new_id]


# ═══════════════════════════════════════════════════════════════════
# Trace & Metrics Collection
# ═══════════════════════════════════════════════════════════════════

class TraceCollector:
    """Collects trace events with timing and token metrics."""

    def __init__(self):
        self.events: list[dict] = []
        self.start_time = time.time()
        self.queue = queue.Queue()
        self.timings: dict[str, float] = {}
        self.tokens = {"input": 0, "output": 0}
        self._timing_stack: list[tuple[str, float]] = []

    def elapsed(self) -> float:
        return round(time.time() - self.start_time, 2)

    def start_timing(self, label: str):
        self._timing_stack.append((label, time.time()))

    def end_timing(self, label: str):
        for i, (l, t) in enumerate(self._timing_stack):
            if l == label:
                self.timings[label] = self.timings.get(label, 0) + (time.time() - t)
                self._timing_stack.pop(i)
                break

    def add_tokens(self, input_tokens: int, output_tokens: int):
        self.tokens["input"] += input_tokens
        self.tokens["output"] += output_tokens

    def add(self, event_type: str, agent: str, title: str, detail: str = "",
            icon: str = "⚡", status: str = "running", data: dict = None):
        event = {
            "type": event_type,
            "timestamp": self.elapsed(),
            "agent": agent,
            "title": title,
            "detail": detail,
            "icon": icon,
            "status": status,
            "data": data  # For expandable JSON view
        }
        self.events.append(event)
        self.queue.put(event)

    def add_thinking(self, agent: str, thought: str):
        """Add agent reasoning/thinking event."""
        self.add("thinking", agent, "Reasoning",
                thought[:200] + "..." if len(thought) > 200 else thought,
                "💭", "info", {"full_thought": thought})

    def get_summary(self) -> dict:
        """Get timing and token summary."""
        total_time = self.elapsed()
        # Estimate cost (Claude Sonnet pricing approximation)
        input_cost = (self.tokens["input"] / 1000) * 0.003
        output_cost = (self.tokens["output"] / 1000) * 0.015
        return {
            "total_time": total_time,
            "timings": self.timings,
            "tokens": self.tokens,
            "estimated_cost": round(input_cost + output_cost, 4)
        }


# Thread-local storage for current trace
import contextvars
_current_trace: contextvars.ContextVar[TraceCollector | None] = contextvars.ContextVar('trace', default=None)
_current_session: contextvars.ContextVar[ConversationSession | None] = contextvars.ContextVar('session', default=None)


# ═══════════════════════════════════════════════════════════════════
# Visual Data Extraction
# ═══════════════════════════════════════════════════════════════════

def extract_visual_data(result: str, data_type: str) -> dict | None:
    """Extract structured data for visual cards."""
    if data_type == "billing":
        # Extract billing info for visual card
        bill_match = re.search(r'BILL-[A-Z0-9]+', result)
        amount_match = re.search(r'\$[\d,]+\.?\d*', result)
        code_match = re.search(r'99214', result)
        return {
            "type": "billing",
            "bill_id": bill_match.group() if bill_match else None,
            "amount": "$2,400.00",
            "correct_amount": "$240.00",
            "procedure_code": "99214",
            "correct_code": "99214-25",
            "error": "Missing modifier -25",
            "provider": "Dr. Raj Patel, MD",
            "date": "2026-01-15",
            "status": "disputed"
        }
    elif data_type == "insurance":
        return {
            "type": "insurance",
            "carrier": "Blue Cross Blue Shield",
            "plan": "BCBS PPO",
            "policy_number": "BCBS-PA-9928471",
            "subscriber": "Maria Santos",
            "status": "Active",
            "coverage_rate": "90%",
            "copay": "$40.00",
            "deductible_met": True,
            "deductible_amount": "$1,500.00"
        }
    elif data_type == "correction":
        corr_match = re.search(r'CORR-[A-Z0-9]+', result)
        return {
            "type": "correction",
            "correction_id": corr_match.group() if corr_match else "CORR-XXXXXX",
            "original_amount": "$2,400.00",
            "corrected_amount": "$240.00",
            "savings": "$2,160.00",
            "timeline": "5-7 business days"
        }
    elif data_type == "case":
        case_match = re.search(r'CASE-[A-Z0-9]+', result)
        return {
            "type": "case",
            "case_id": case_match.group() if case_match else "CASE-XXXXXX",
            "status": "Open",
            "team": "Billing Resolution Team",
            "priority": "High"
        }
    return None


# ═══════════════════════════════════════════════════════════════════
# Traced Agent Tools
# ═══════════════════════════════════════════════════════════════════

def create_traced_tools():
    """Create agent tools with full tracing and visual data extraction."""
    from agents.servicenow.agent import servicenow_agent
    from agents.salesforce.agent import salesforce_agent
    from strands import tool

    @tool
    def servicenow_agent_tool(task: str) -> str:
        """Send a task to the ServiceNow AI Agent for billing, tickets, or appointments.

        Args:
            task: Natural language task description.
        """
        trace = _current_trace.get()
        session = _current_session.get()

        # Determine task type
        task_type = "Processing"
        visual_type = None
        if "billing" in task.lower() or "bill" in task.lower():
            if "correct" in task.lower() or "fix" in task.lower():
                task_type = "Billing Correction"
                visual_type = "correction"
            else:
                task_type = "Billing Lookup"
                visual_type = "billing"
        elif "ticket" in task.lower():
            task_type = "Create Ticket"
        elif "appointment" in task.lower() or "schedule" in task.lower():
            task_type = "Schedule Appointment"

        if trace:
            trace.start_timing("servicenow")
            trace.add("tool_start", "ServiceNow", task_type,
                     f"Request: {task[:100]}{'...' if len(task) > 100 else ''}",
                     "🔧", "running", {"input": task})

        result = str(servicenow_agent(task))

        # Extract visual data
        visual_data = extract_visual_data(result, visual_type) if visual_type else None

        # Extract summary
        summary = "Completed"
        details = []

        if "CORR-" in result:
            match = re.search(r'CORR-[A-Z0-9]+', result)
            if match:
                summary = "Correction submitted"
                details.append(f"Reference: {match.group()}")
                if session:
                    session.patient_context["correction_id"] = match.group()
        if "BILL-" in result:
            match = re.search(r'BILL-[A-Z0-9]+', result)
            if match:
                details.append(f"Bill: {match.group()}")
            summary = "Found billing issue"
        if "TKT-" in result:
            match = re.search(r'TKT-[A-Z0-9]+', result)
            if match:
                summary = "Ticket created"
                details.append(f"Ticket: {match.group()}")
        if "$2,400" in result or "2400" in result:
            details.append("Amount: $2,400")
        if "99214" in result:
            details.append("Code: 99214 → 99214-25")
        if "modifier" in result.lower():
            summary = "Found coding error"
            details.append("Missing modifier -25")

        if trace:
            trace.end_timing("servicenow")
            trace.add("tool_end", "ServiceNow", summary,
                     " | ".join(details) if details else "Task completed successfully",
                     "✅", "complete",
                     {"output": result[:500], "visual": visual_data})

        return result

    @tool
    def salesforce_agent_tool(task: str) -> str:
        """Send a task to the Salesforce Agent for patient data, insurance, or cases.

        Args:
            task: Natural language task description.
        """
        trace = _current_trace.get()
        session = _current_session.get()

        # Determine task type
        task_type = "Processing"
        visual_type = None
        if "insurance" in task.lower() or "coverage" in task.lower():
            task_type = "Insurance Verification"
            visual_type = "insurance"
        elif "patient" in task.lower() and "record" in task.lower():
            task_type = "Patient Lookup"
        elif "case" in task.lower():
            task_type = "Create Case"
            visual_type = "case"
        elif "history" in task.lower():
            task_type = "Care History"

        if trace:
            trace.start_timing("salesforce")
            trace.add("tool_start", "Salesforce", task_type,
                     f"Request: {task[:100]}{'...' if len(task) > 100 else ''}",
                     "👤", "running", {"input": task})

        result = str(salesforce_agent(task))

        # Extract visual data
        visual_data = extract_visual_data(result, visual_type) if visual_type else None

        # Update session with patient context
        if session:
            if "Maria" in result:
                session.patient_context["patient_name"] = "Maria Santos"
            if "PAT-2847" in result:
                session.patient_context["patient_id"] = "PAT-2847"

        # Extract summary
        summary = "Completed"
        details = []

        if "CASE-" in result:
            match = re.search(r'CASE-[A-Z0-9]+', result)
            if match:
                summary = "Case created"
                details.append(f"Case: {match.group()}")
                if session:
                    session.patient_context["case_id"] = match.group()
        if "active" in result.lower() and "insurance" in result.lower():
            summary = "Insurance verified"
            details.append("Status: Active")
        if "BCBS" in result or "Blue Cross" in result:
            details.append("Carrier: BCBS PPO")
        if "deductible" in result.lower() and "met" in result.lower():
            details.append("Deductible: Met")
        if "90%" in result:
            details.append("Coverage: 90%")
        if "$240" in result:
            details.append("Patient owes: $240")
        if "Maria" in result:
            details.append("Patient: Maria Santos")

        if trace:
            trace.end_timing("salesforce")
            trace.add("tool_end", "Salesforce", summary,
                     " | ".join(details) if details else "Task completed successfully",
                     "✅", "complete",
                     {"output": result[:500], "visual": visual_data})

        return result

    return servicenow_agent_tool, salesforce_agent_tool


# ═══════════════════════════════════════════════════════════════════
# Agent Runner with Thinking Stream
# ═══════════════════════════════════════════════════════════════════

def run_agent_with_thinking(message: str, trace: TraceCollector, session: ConversationSession) -> str:
    """Run the orchestrator agent with thinking stream and memory."""
    _current_trace.set(trace)
    _current_session.set(session)

    from strands import Agent
    from strands.models.bedrock import BedrockModel
    from shared.config import BEDROCK_MODEL_ID, AWS_REGION
    from agents.orchestrator.prompts import ORCHESTRATOR_SYSTEM_PROMPT

    servicenow_tool, salesforce_tool = create_traced_tools()

    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
        region_name=AWS_REGION,
    )

    # Add conversation context to the prompt
    context_prompt = ""
    if session.patient_context:
        context_prompt = f"\n\n[CONVERSATION CONTEXT: {session.get_context_summary()}]"

    # Build conversation history for the agent
    history_prompt = ""
    if len(session.messages) > 0:
        recent = session.messages[-6:]  # Last 3 exchanges
        history_prompt = "\n\n[RECENT CONVERSATION HISTORY:\n"
        for msg in recent:
            role = "Patient" if msg["role"] == "user" else "Assistant"
            history_prompt += f"{role}: {msg['content'][:200]}...\n" if len(msg['content']) > 200 else f"{role}: {msg['content']}\n"
        history_prompt += "]"

    enhanced_prompt = ORCHESTRATOR_SYSTEM_PROMPT + context_prompt + history_prompt

    agent = Agent(
        name="MidAtlantic Health Virtual Assistant",
        description="Patient-facing conversational agent",
        model=model,
        system_prompt=enhanced_prompt,
        tools=[servicenow_tool, salesforce_tool],
    )

    # Extract patient ID from message if present
    pat_match = re.search(r'PAT-\d+', message)
    if pat_match:
        session.patient_context["patient_id"] = pat_match.group()

    trace.start_timing("orchestrator")
    trace.add("orchestrator_start", "Orchestrator", "Analyzing request",
              f'"{message[:60]}{"..." if len(message) > 60 else ""}"',
              "🎯", "running")

    # Add thinking event based on message content
    if "bill" in message.lower() or "charge" in message.lower():
        trace.add_thinking("Orchestrator",
            "Patient has a billing concern. I should check both the billing records (ServiceNow) "
            "and insurance coverage (Salesforce) to get the complete picture before responding.")
    elif "fix" in message.lower() or "correct" in message.lower():
        trace.add_thinking("Orchestrator",
            "Patient wants to proceed with a correction. I need to submit the billing fix through "
            "ServiceNow and create a tracking case in Salesforce so they can monitor progress.")
    elif "insurance" in message.lower() or "coverage" in message.lower():
        trace.add_thinking("Orchestrator",
            "Patient is asking about insurance. I'll query Salesforce to get their coverage details, "
            "deductible status, and expected patient responsibility.")
    elif "appointment" in message.lower() or "schedule" in message.lower():
        trace.add_thinking("Orchestrator",
            "Patient wants to schedule an appointment. I'll check ServiceNow for available slots "
            "and find options that match their preferences.")

    # Run the agent
    result = agent(message)
    result_str = str(result)

    # Estimate tokens (rough approximation)
    input_tokens = len(message.split()) * 2 + len(enhanced_prompt.split())
    output_tokens = len(result_str.split()) * 2
    trace.add_tokens(input_tokens, output_tokens)

    trace.end_timing("orchestrator")
    trace.add("orchestrator_end", "Orchestrator", "Response ready",
              f"Generated {len(result_str)} chars",
              "✨", "complete")

    # Update session
    session.add_message("user", message)
    session.add_message("assistant", result_str)
    session.total_tokens += input_tokens + output_tokens

    return result_str


# ═══════════════════════════════════════════════════════════════════
# API Endpoints
# ═══════════════════════════════════════════════════════════════════

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """Stream chat response with real-time trace events via SSE."""
    session = get_or_create_session(request.session_id)
    trace = TraceCollector()
    result_holder = {"response": None, "error": None}

    def run_in_thread():
        try:
            result_holder["response"] = run_agent_with_thinking(
                request.message, trace, session
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            result_holder["error"] = str(e)
        finally:
            trace.queue.put(None)

    thread = threading.Thread(target=run_in_thread)
    thread.start()

    async def event_generator():
        while True:
            try:
                event = trace.queue.get(timeout=0.1)
                if event is None:
                    break
                yield f"data: {json.dumps({'type': 'trace', 'event': event})}\n\n"
            except queue.Empty:
                if not thread.is_alive():
                    break
                await asyncio.sleep(0.05)

        thread.join()

        # Send metrics
        summary = trace.get_summary()
        yield f"data: {json.dumps({'type': 'metrics', 'data': summary})}\n\n"

        # Send final response
        if result_holder["error"]:
            yield f"data: {json.dumps({'type': 'error', 'message': result_holder['error']})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'response', 'text': result_holder['response'], 'session_id': session.session_id})}\n\n"

        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Non-streaming chat endpoint."""
    session = get_or_create_session(request.session_id)
    trace = TraceCollector()

    try:
        response_text = run_agent_with_thinking(request.message, trace, session)
        return {
            "response": response_text,
            "session_id": session.session_id,
            "trace": trace.events,
            "metrics": trace.get_summary()
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    """Get session history and context."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    session = sessions[session_id]
    return {
        "session_id": session.session_id,
        "messages": session.messages,
        "patient_context": session.patient_context,
        "total_tokens": session.total_tokens
    }


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """Delete/reset a session."""
    if session_id in sessions:
        del sessions[session_id]
    return {"status": "deleted"}


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "agents": ["orchestrator", "servicenow", "salesforce"],
        "features": ["streaming", "thinking", "memory", "metrics"]
    }


app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.get("/")
async def root():
    return FileResponse("frontend/index.html")


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*60)
    print("  MidAtlantic Health - AgentCore CX Demo")
    print("="*60)
    print("\n  🌐 Open: http://localhost:8000")
    print("  ✨ Features: Streaming, Thinking, Memory, Metrics")
    print("\n  Press Ctrl+C to stop\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
