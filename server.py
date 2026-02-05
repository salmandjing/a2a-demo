"""API server with real-time streaming agent traces."""

import json
import uuid
import time
import asyncio
import queue
import threading
from datetime import datetime
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


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class TraceCollector:
    """Collects trace events and allows streaming them."""

    def __init__(self):
        self.events: list[dict] = []
        self.start_time = time.time()
        self.queue = queue.Queue()

    def elapsed(self) -> float:
        return round(time.time() - self.start_time, 2)

    def add(self, event_type: str, agent: str, title: str, detail: str = "",
            icon: str = "⚡", status: str = "running"):
        event = {
            "type": event_type,
            "timestamp": self.elapsed(),
            "agent": agent,
            "title": title,
            "detail": detail,
            "icon": icon,
            "status": status
        }
        self.events.append(event)
        self.queue.put(event)

    def get_all(self) -> list[dict]:
        return self.events.copy()


# Thread-local storage for current trace
import contextvars
_current_trace: contextvars.ContextVar[TraceCollector | None] = contextvars.ContextVar('trace', default=None)


def create_traced_tools():
    """Create wrapped versions of the agent tools that emit detailed trace events."""
    from agents.servicenow.agent import servicenow_agent
    from agents.salesforce.agent import salesforce_agent
    from strands import tool
    import re

    @tool
    def servicenow_agent_tool(task: str) -> str:
        """Send a task to the ServiceNow AI Agent for billing, tickets, or appointments.

        Args:
            task: Natural language task description.
        """
        trace = _current_trace.get()

        # Determine task type for better labeling
        task_type = "Processing"
        if "billing" in task.lower() or "bill" in task.lower():
            task_type = "Billing Lookup"
        elif "correct" in task.lower() or "fix" in task.lower():
            task_type = "Billing Correction"
        elif "ticket" in task.lower():
            task_type = "Create Ticket"
        elif "appointment" in task.lower() or "schedule" in task.lower():
            task_type = "Schedule Appointment"

        if trace:
            trace.add("tool_start", "ServiceNow", task_type,
                     f"Request: {task[:100]}{'...' if len(task) > 100 else ''}",
                     "🔧", "running")

        result = str(servicenow_agent(task))

        # Extract meaningful summary from result
        summary = "Completed"
        details = []

        if "CORR-" in result:
            match = re.search(r'CORR-[A-Z0-9]+', result)
            if match:
                summary = f"Correction submitted"
                details.append(f"Reference: {match.group()}")
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
            trace.add("tool_end", "ServiceNow", summary,
                     " | ".join(details) if details else "Task completed successfully",
                     "✅", "complete")
        return result

    @tool
    def salesforce_agent_tool(task: str) -> str:
        """Send a task to the Salesforce Agent for patient data, insurance, or cases.

        Args:
            task: Natural language task description.
        """
        trace = _current_trace.get()

        # Determine task type
        task_type = "Processing"
        if "insurance" in task.lower() or "coverage" in task.lower():
            task_type = "Insurance Verification"
        elif "patient" in task.lower() and "record" in task.lower():
            task_type = "Patient Lookup"
        elif "case" in task.lower():
            task_type = "Create Case"
        elif "history" in task.lower():
            task_type = "Care History"

        if trace:
            trace.add("tool_start", "Salesforce", task_type,
                     f"Request: {task[:100]}{'...' if len(task) > 100 else ''}",
                     "👤", "running")

        result = str(salesforce_agent(task))

        # Extract summary
        summary = "Completed"
        details = []

        if "CASE-" in result:
            match = re.search(r'CASE-[A-Z0-9]+', result)
            if match:
                summary = "Case created"
                details.append(f"Case: {match.group()}")
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
            trace.add("tool_end", "Salesforce", summary,
                     " | ".join(details) if details else "Task completed successfully",
                     "✅", "complete")
        return result

    return servicenow_agent_tool, salesforce_agent_tool


def run_agent_sync(message: str, trace: TraceCollector) -> str:
    """Run the orchestrator agent synchronously with tracing."""
    _current_trace.set(trace)

    from strands import Agent
    from strands.models.bedrock import BedrockModel
    from shared.config import BEDROCK_MODEL_ID, AWS_REGION
    from agents.orchestrator.prompts import ORCHESTRATOR_SYSTEM_PROMPT

    servicenow_tool, salesforce_tool = create_traced_tools()

    model = BedrockModel(
        model_id=BEDROCK_MODEL_ID,
        region_name=AWS_REGION,
    )

    agent = Agent(
        name="MidAtlantic Health Virtual Assistant",
        description="Patient-facing conversational agent",
        model=model,
        system_prompt=ORCHESTRATOR_SYSTEM_PROMPT,
        tools=[servicenow_tool, salesforce_tool],
    )

    trace.add("orchestrator_start", "Orchestrator", "Analyzing request",
              f'"{message[:60]}{"..." if len(message) > 60 else ""}"',
              "🎯", "running")

    result = agent(message)

    trace.add("orchestrator_end", "Orchestrator", "Response ready",
              f"Generated {len(str(result))} chars",
              "✨", "complete")

    return str(result)


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """Stream chat response with real-time trace events via SSE."""

    trace = TraceCollector()
    result_holder = {"response": None, "error": None}

    def run_in_thread():
        try:
            result_holder["response"] = run_agent_sync(request.message, trace)
        except Exception as e:
            result_holder["error"] = str(e)
        finally:
            trace.queue.put(None)  # Signal completion

    # Start agent in background thread
    thread = threading.Thread(target=run_in_thread)
    thread.start()

    async def event_generator():
        while True:
            try:
                # Check for events with timeout
                event = trace.queue.get(timeout=0.1)
                if event is None:
                    # Agent finished
                    break
                yield f"data: {json.dumps({'type': 'trace', 'event': event})}\n\n"
            except queue.Empty:
                # No event yet, check if thread is still alive
                if not thread.is_alive():
                    break
                await asyncio.sleep(0.05)

        # Wait for thread to complete
        thread.join()

        # Send final response
        if result_holder["error"]:
            yield f"data: {json.dumps({'type': 'error', 'message': result_holder['error']})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'response', 'text': result_holder['response'], 'trace': trace.get_all()})}\n\n"

        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Non-streaming chat endpoint (fallback)."""
    conv_id = request.conversation_id or str(uuid.uuid4())
    trace = TraceCollector()

    try:
        response_text = run_agent_sync(request.message, trace)
        return {
            "response": response_text,
            "conversation_id": conv_id,
            "trace": trace.get_all()
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health():
    return {"status": "healthy", "agents": ["orchestrator", "servicenow", "salesforce"]}


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
    print("  📊 Real-time agent activity streaming")
    print("\n  Press Ctrl+C to stop\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
