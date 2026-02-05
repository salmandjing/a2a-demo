// MidAtlantic Health - Real-time Agent Activity Streaming with Full Observability

const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');
const traceContent = document.getElementById('traceContent');
const traceBadge = document.getElementById('traceBadge');
const resetButton = document.getElementById('resetButton');
const metricsPanel = document.getElementById('metricsPanel');
const jsonToggle = document.getElementById('jsonToggle');
const jsonModal = document.getElementById('jsonModal');
const jsonModalClose = document.getElementById('jsonModalClose');
const jsonContent = document.getElementById('jsonContent');

// Metric elements
const metricTime = document.getElementById('metricTime');
const metricTokens = document.getElementById('metricTokens');
const metricCost = document.getElementById('metricCost');
const timingBreakdown = document.getElementById('timingBreakdown');

// Architecture diagram elements
const archOrchestrator = document.getElementById('archOrchestrator');
const archServicenow = document.getElementById('archServicenow');
const archSalesforce = document.getElementById('archSalesforce');
const archLine1 = document.getElementById('archLine1');
const archLine2 = document.getElementById('archLine2');

let sessionId = null;
let isProcessing = false;
let showJsonView = false;
let allTraceEvents = [];

const welcomeMessageHTML = `
    <div class="message assistant">
        <div class="message-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#0066cc"/>
                <path d="M12 6v12M6 12h12" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </div>
        <div class="message-content">
            <p>Hello! I'm your MidAtlantic Health virtual assistant. I can help you with:</p>
            <ul>
                <li>Billing questions and disputes</li>
                <li>Insurance verification</li>
                <li>Appointment scheduling</li>
            </ul>
            <p>How can I assist you today?</p>
        </div>
    </div>
`;

const traceEmptyHTML = `
    <div class="trace-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
        </svg>
        <p>Agent activity will stream here in real-time</p>
    </div>
`;

// Reset
resetButton?.addEventListener('click', async () => {
    if (isProcessing) return;

    // Delete session on server
    if (sessionId) {
        try {
            await fetch(`/api/session/${sessionId}`, { method: 'DELETE' });
        } catch (e) {
            console.log('Session delete failed (ok):', e);
        }
    }

    sessionId = null;
    allTraceEvents = [];
    chatMessages.innerHTML = welcomeMessageHTML;
    traceContent.innerHTML = traceEmptyHTML;
    metricsPanel.style.display = 'none';
    setTraceStatus('Ready', false);
    resetArchDiagram();
    messageInput.value = '';
    messageInput.focus();
});

// JSON toggle
jsonToggle?.addEventListener('click', () => {
    if (allTraceEvents.length === 0) return;
    showJsonView = !showJsonView;
    jsonToggle.classList.toggle('active', showJsonView);

    if (showJsonView) {
        jsonContent.textContent = JSON.stringify(allTraceEvents, null, 2);
        jsonModal.style.display = 'flex';
    } else {
        jsonModal.style.display = 'none';
    }
});

jsonModalClose?.addEventListener('click', () => {
    jsonModal.style.display = 'none';
    showJsonView = false;
    jsonToggle.classList.remove('active');
});

jsonModal?.addEventListener('click', (e) => {
    if (e.target === jsonModal) {
        jsonModal.style.display = 'none';
        showJsonView = false;
        jsonToggle.classList.remove('active');
    }
});

// Input handling
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    sendButton.disabled = !messageInput.value.trim() || isProcessing;
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) sendMessage();
    }
});

sendButton.addEventListener('click', sendMessage);

// Demo buttons
document.querySelectorAll('.demo-button').forEach(button => {
    button.addEventListener('click', () => {
        if (isProcessing) return;
        messageInput.value = button.dataset.message;
        messageInput.dispatchEvent(new Event('input'));
        sendMessage();
    });
});

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isProcessing) return;

    isProcessing = true;
    sendButton.disabled = true;

    addMessage(message, 'user');
    messageInput.value = '';
    messageInput.style.height = 'auto';

    typingIndicator.style.display = 'block';
    scrollToBottom();

    // Clear trace and start streaming
    traceContent.innerHTML = '';
    allTraceEvents = [];
    metricsPanel.style.display = 'none';
    setTraceStatus('Running', true);
    highlightArchNode('orchestrator');

    try {
        // Use streaming endpoint
        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, session_id: sessionId })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        handleStreamEvent(data);
                    } catch (e) {
                        console.error('Parse error:', e);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Stream error:', error);
        typingIndicator.style.display = 'none';
        addMessage('I apologize, but I encountered an error. Please try again.', 'assistant');
        setTraceStatus('Error', false);
    }

    resetArchDiagram();
    isProcessing = false;
    sendButton.disabled = !messageInput.value.trim();
}

function handleStreamEvent(data) {
    switch (data.type) {
        case 'trace':
            allTraceEvents.push(data.event);
            addTraceEvent(data.event);
            break;
        case 'metrics':
            displayMetrics(data.data);
            break;
        case 'response':
            typingIndicator.style.display = 'none';
            addMessage(data.text, 'assistant');
            if (data.session_id) sessionId = data.session_id;
            setTraceStatus('Complete', false);
            break;
        case 'error':
            typingIndicator.style.display = 'none';
            addMessage('Error: ' + data.message, 'assistant');
            setTraceStatus('Error', false);
            break;
        case 'done':
            break;
    }
}

function addMessage(content, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';

    if (role === 'assistant') {
        avatarDiv.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#0066cc"/>
                <path d="M12 6v12M6 12h12" stroke="white" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = formatMessage(content);

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function formatMessage(content) {
    return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^- (.*?)(<br>|$)/gm, '<li>$1</li>')
        .replace(/((?:CORR|CASE|TKT|BILL)-[A-Z0-9]+)/g, '<code>$1</code>')
        .replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>')
        .replace(/^(?!<)/, '<p>')
        .replace(/(?!>)$/, '</p>');
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ─── Trace Panel ───────────────────────────────────────────────

function setTraceStatus(text, active) {
    traceBadge.textContent = text;
    traceBadge.className = 'trace-badge' + (active ? ' active' : '');
}

function addTraceEvent(event) {
    // Determine styling
    let agentClass = 'orchestrator';
    if (event.agent?.toLowerCase().includes('servicenow')) agentClass = 'servicenow';
    if (event.agent?.toLowerCase().includes('salesforce')) agentClass = 'salesforce';

    // Special styling for thinking events
    const isThinking = event.type === 'thinking';
    if (isThinking) agentClass = 'thinking';

    const statusClass = event.status === 'complete' ? 'complete' :
                       event.status === 'info' ? 'info' : 'running';

    // Highlight architecture
    if (!isThinking) {
        highlightArchNode(agentClass);
    }

    const eventDiv = document.createElement('div');
    eventDiv.className = `trace-event ${agentClass} ${statusClass}`;

    // Store data for expandable view
    if (event.data) {
        eventDiv.dataset.eventData = JSON.stringify(event.data);
    }

    eventDiv.innerHTML = `
        <div class="trace-icon">${event.icon}</div>
        <div class="trace-body">
            <div class="trace-event-header">
                <span class="trace-agent">${event.agent}</span>
                <span class="trace-time">${event.timestamp}s</span>
            </div>
            <div class="trace-event-title">${escapeHtml(event.title)}</div>
            ${event.detail ? `<div class="trace-detail">${escapeHtml(event.detail)}</div>` : ''}
            ${event.data ? '<div class="trace-expand-indicator">Click to expand</div>' : ''}
            <div class="trace-expanded-content"></div>
            ${event.data?.visual ? renderVisualCard(event.data.visual) : ''}
        </div>
        <div class="trace-status ${statusClass}">
            ${statusClass === 'running' ? '<div class="spinner"></div>' :
              statusClass === 'info' ? '💭' : '✓'}
        </div>
    `;

    // Add click handler for expandable detail
    eventDiv.addEventListener('click', () => {
        if (!event.data) return;
        eventDiv.classList.toggle('expanded');
        const expandedContent = eventDiv.querySelector('.trace-expanded-content');
        if (expandedContent && eventDiv.classList.contains('expanded')) {
            expandedContent.textContent = JSON.stringify(event.data, null, 2);
        }
    });

    traceContent.appendChild(eventDiv);
    traceContent.scrollTop = traceContent.scrollHeight;

    // If this is an end event, update the corresponding start event
    if (event.type.includes('end')) {
        const events = traceContent.querySelectorAll(`.trace-event.${agentClass}.running`);
        events.forEach(el => {
            el.classList.remove('running');
            el.classList.add('complete');
            const status = el.querySelector('.trace-status');
            if (status) {
                status.classList.remove('running');
                status.classList.add('complete');
                status.innerHTML = '✓';
            }
        });
    }
}

function renderVisualCard(visual) {
    if (!visual) return '';

    const cardType = visual.type;
    let cardContent = '';

    switch (cardType) {
        case 'billing':
            cardContent = `
                <div class="card-header">
                    <span class="card-type">Billing Record</span>
                    <span class="card-id">${visual.bill_id || 'BILL-XXXXX'}</span>
                </div>
                <div class="card-grid">
                    <div class="card-field">
                        <div class="card-label">Charged Amount</div>
                        <div class="card-value error">${visual.amount}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Correct Amount</div>
                        <div class="card-value success">${visual.correct_amount}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Procedure Code</div>
                        <div class="card-value">${visual.procedure_code}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Should Be</div>
                        <div class="card-value highlight">${visual.correct_code}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Error</div>
                        <div class="card-value error">${visual.error}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Provider</div>
                        <div class="card-value">${visual.provider}</div>
                    </div>
                </div>
            `;
            break;

        case 'insurance':
            cardContent = `
                <div class="card-header">
                    <span class="card-type">Insurance Coverage</span>
                    <span class="card-id">${visual.plan}</span>
                </div>
                <div class="card-grid">
                    <div class="card-field">
                        <div class="card-label">Carrier</div>
                        <div class="card-value">${visual.carrier}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Status</div>
                        <div class="card-value success">${visual.status}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Coverage Rate</div>
                        <div class="card-value highlight">${visual.coverage_rate}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Copay</div>
                        <div class="card-value">${visual.copay}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Deductible</div>
                        <div class="card-value success">${visual.deductible_met ? 'Met' : 'Not Met'}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Amount</div>
                        <div class="card-value">${visual.deductible_amount}</div>
                    </div>
                </div>
            `;
            break;

        case 'correction':
            cardContent = `
                <div class="card-header">
                    <span class="card-type">Billing Correction</span>
                    <span class="card-id">${visual.correction_id}</span>
                </div>
                <div class="card-grid">
                    <div class="card-field">
                        <div class="card-label">Original</div>
                        <div class="card-value error">${visual.original_amount}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Corrected</div>
                        <div class="card-value success">${visual.corrected_amount}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">You Save</div>
                        <div class="card-value highlight">${visual.savings}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Timeline</div>
                        <div class="card-value">${visual.timeline}</div>
                    </div>
                </div>
            `;
            break;

        case 'case':
            cardContent = `
                <div class="card-header">
                    <span class="card-type">Support Case</span>
                    <span class="card-id">${visual.case_id}</span>
                </div>
                <div class="card-grid">
                    <div class="card-field">
                        <div class="card-label">Status</div>
                        <div class="card-value highlight">${visual.status}</div>
                    </div>
                    <div class="card-field">
                        <div class="card-label">Priority</div>
                        <div class="card-value">${visual.priority}</div>
                    </div>
                    <div class="card-field" style="grid-column: span 2;">
                        <div class="card-label">Assigned Team</div>
                        <div class="card-value">${visual.team}</div>
                    </div>
                </div>
            `;
            break;

        default:
            return '';
    }

    return `<div class="visual-card ${cardType}">${cardContent}</div>`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ─── Metrics Display ──────────────────────────────────────────

function displayMetrics(metrics) {
    metricsPanel.style.display = 'block';

    // Update metric values
    metricTime.textContent = `${metrics.total_time}s`;
    metricTokens.textContent = `${metrics.tokens.input + metrics.tokens.output}`;
    metricCost.textContent = `$${metrics.estimated_cost.toFixed(4)}`;

    // Create timing breakdown bar
    const timings = metrics.timings || {};
    const totalTime = metrics.total_time || 1;

    const orchestratorTime = timings.orchestrator || 0;
    const servicenowTime = timings.servicenow || 0;
    const salesforceTime = timings.salesforce || 0;

    const orchestratorPct = (orchestratorTime / totalTime * 100).toFixed(0);
    const servicenowPct = (servicenowTime / totalTime * 100).toFixed(0);
    const salesforcePct = (salesforceTime / totalTime * 100).toFixed(0);

    timingBreakdown.innerHTML = `
        <div class="timing-bar">
            <div class="timing-segment orchestrator" style="width: ${orchestratorPct}%"></div>
            <div class="timing-segment servicenow" style="width: ${servicenowPct}%"></div>
            <div class="timing-segment salesforce" style="width: ${salesforcePct}%"></div>
        </div>
        <div class="timing-legend">
            <div class="timing-legend-item">
                <div class="timing-dot orchestrator"></div>
                <span>Orchestrator ${orchestratorTime.toFixed(1)}s</span>
            </div>
            <div class="timing-legend-item">
                <div class="timing-dot servicenow"></div>
                <span>ServiceNow ${servicenowTime.toFixed(1)}s</span>
            </div>
            <div class="timing-legend-item">
                <div class="timing-dot salesforce"></div>
                <span>Salesforce ${salesforceTime.toFixed(1)}s</span>
            </div>
        </div>
    `;
}

// ─── Architecture Diagram ──────────────────────────────────────

function highlightArchNode(agentKey) {
    [archOrchestrator, archServicenow, archSalesforce].forEach(n => n?.classList.remove('active'));
    [archLine1, archLine2].forEach(l => l?.classList.remove('active'));

    if (agentKey === 'orchestrator') {
        archOrchestrator?.classList.add('active');
    } else if (agentKey === 'servicenow') {
        archServicenow?.classList.add('active');
        archLine1?.classList.add('active');
    } else if (agentKey === 'salesforce') {
        archSalesforce?.classList.add('active');
        archLine2?.classList.add('active');
    }
}

function resetArchDiagram() {
    setTimeout(() => {
        [archOrchestrator, archServicenow, archSalesforce].forEach(n => n?.classList.remove('active'));
        [archLine1, archLine2].forEach(l => l?.classList.remove('active'));
    }, 1500);
}

messageInput.focus();
