# Progress

## Next Steps

_Items to be implemented, prioritized by importance._

1. **Unit tests** - Add pytest tests for each agent (`tests/`)
2. **A2A protocol testing** - Test with A2A servers running locally
3. **AgentCore deployment** - Deploy to AWS AgentCore Runtime
4. **CloudWatch observability** - Add trace visualization to frontend

---

## Technical Debt

_Known shortcuts, workarounds, or areas needing improvement._

- A2A async-to-sync wrapper in `a2a_tools.py` uses ThreadPoolExecutor which may not be optimal for high concurrency
- Mock data is loaded at module import time (could lazy-load for faster startup)
- No retry logic for A2A network calls

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
