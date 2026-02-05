# Progress

## Next Steps

_Items to be implemented, prioritized by importance._

1. **Unit tests** - Add pytest tests for each agent (`tests/`)
2. **A2A protocol testing** - Test with A2A servers running locally
3. **AgentCore deployment** - Deploy to AWS AgentCore Runtime
4. **A2A mode toggle** - UI switch to toggle between direct mode and A2A protocol mode

---

## Technical Debt

_Known shortcuts, workarounds, or areas needing improvement._

- A2A async-to-sync wrapper in `a2a_tools.py` uses ThreadPoolExecutor which may not be optimal for high concurrency
- Mock data is loaded at module import time (could lazy-load for faster startup)
- No retry logic for A2A network calls
- Token count is estimated (rough approximation, not from actual API response)
- Session storage is in-memory (would use Redis in production)
- Visual data extraction is somewhat hardcoded for demo scenario

---

## Completed

_Recently completed items (move here from Next Steps when done)._

- Initial documentation setup
- Project configuration (pyproject.toml, requirements, env)
- Shared config and mock data
- ServiceNow agent with domain tools
- Salesforce agent with domain tools
- Orchestrator agent with A2A/direct mode tools
- Test scripts (local_test.py, deploy_all.sh, teardown.sh)
- Local testing with Bedrock (all 3 agents + full orchestrator flow verified)
- Frontend chat UI with FastAPI backend (`server.py`, `frontend/`)
- Real-time SSE streaming for agent activity trace
- Improved demo UX: reset button, better scenarios, step-by-step flow
- **Agent "thinking" stream** - Shows agent reasoning in trace panel (💭)
- **Visual data cards** - Rich cards for billing, insurance, correction, case data
- **Expandable trace details** - Click to see raw JSON input/output
- **Conversation memory** - Session persistence with patient context
- **Timing breakdown** - Visual bar showing time per agent with legend
- **Cost/token display** - Metrics panel with token count and estimated cost
- **JSON view toggle** - Modal to view raw JSON of all trace events
- **Error scenario demo** - Demo button for unknown patient error handling
