// MidAtlantic Health - AI Healthcare Assistant
// Real-time multi-agent orchestration with full observability

const $ = id => document.getElementById(id);

// Elements
const chatMessages = $('chatMessages');
const messageInput = $('messageInput');
const sendButton = $('sendButton');
const chatStatus = $('chatStatus');
const traceContent = $('traceContent');
const resetButton = $('resetButton');
const metricsPanel = $('metricsPanel');
const jsonToggle = $('jsonToggle');
const jsonModal = $('jsonModal');
const jsonModalClose = $('jsonModalClose');
const jsonContent = $('jsonContent');
const typingTemplate = $('typingTemplate');

// Metrics
const metricTime = $('metricTime');
const metricTokens = $('metricTokens');
const metricCost = $('metricCost');
const timingBar = $('timingBar');

// Architecture
const archOrchestrator = $('archOrchestrator');
const archServicenow = $('archServicenow');
const archSalesforce = $('archSalesforce');
const archLine1 = $('archLine1');
const archLine2 = $('archLine2');

// State
let sessionId = null;
let isProcessing = false;
let allTraceEvents = [];

// ═══════════════════════════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════════════════════════

// Reset button
resetButton?.addEventListener('click', async () => {
    if (isProcessing) return;

    if (sessionId) {
        try { await fetch(`/api/session/${sessionId}`, { method: 'DELETE' }); } catch {}
    }

    sessionId = null;
    allTraceEvents = [];

    chatMessages.innerHTML = getWelcomeMessage();
    traceContent.innerHTML = getEmptyTrace();
    metricsPanel.style.display = 'none';
    setStatus('Ready', false);
    resetArch();
    messageInput.value = '';
    messageInput.focus();
});

// JSON modal
jsonToggle?.addEventListener('click', () => {
    if (allTraceEvents.length === 0) return;
    jsonContent.textContent = JSON.stringify(allTraceEvents, null, 2);
    jsonModal.classList.add('open');
});

jsonModalClose?.addEventListener('click', () => jsonModal.classList.remove('open'));
jsonModal?.querySelector('.modal-backdrop')?.addEventListener('click', () => jsonModal.classList.remove('open'));

// Input handling
messageInput?.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    sendButton.disabled = !messageInput.value.trim() || isProcessing;
});

messageInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) sendMessage();
    }
});

sendButton?.addEventListener('click', sendMessage);

// Nav items (demo scenarios)
document.querySelectorAll('.nav-item[data-message]').forEach(item => {
    item.addEventListener('click', () => {
        if (isProcessing) return;
        messageInput.value = item.dataset.message;
        messageInput.dispatchEvent(new Event('input'));
        sendMessage();
    });
});

// ═══════════════════════════════════════════════════════════════
// Chat Functions
// ═══════════════════════════════════════════════════════════════

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isProcessing) return;

    isProcessing = true;
    sendButton.disabled = true;

    addMessage(message, 'user');
    messageInput.value = '';
    messageInput.style.height = 'auto';

    showTyping();
    setStatus('Processing', true);

    // Clear trace
    traceContent.innerHTML = '';
    allTraceEvents = [];
    metricsPanel.style.display = 'none';
    highlightArch('orchestrator');

    try {
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
                        handleEvent(JSON.parse(line.slice(6)));
                    } catch {}
                }
            }
        }
    } catch (error) {
        console.error('Stream error:', error);
        hideTyping();
        addMessage('I apologize, but I encountered an error. Please try again.', 'assistant');
        setStatus('Error', false);
    }

    resetArch();
    isProcessing = false;
    sendButton.disabled = !messageInput.value.trim();
}

function handleEvent(data) {
    switch (data.type) {
        case 'trace':
            allTraceEvents.push(data.event);
            addTraceEvent(data.event);
            break;
        case 'metrics':
            showMetrics(data.data);
            break;
        case 'response':
            hideTyping();
            addMessage(data.text, 'assistant');
            if (data.session_id) sessionId = data.session_id;
            setStatus('Complete', false);
            break;
        case 'error':
            hideTyping();
            addMessage('Error: ' + data.message, 'assistant');
            setStatus('Error', false);
            break;
    }
}

function addMessage(content, role) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    if (role === 'assistant') {
        div.innerHTML = `
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="message-header">Health Assistant</div>
                <div class="message-text">${formatContent(content)}</div>
            </div>
        `;
    } else {
        div.innerHTML = `
            <div class="message-avatar"></div>
            <div class="message-content">
                <div class="message-text">${escapeHtml(content)}</div>
            </div>
        `;
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatContent(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^- (.*?)(<br>|$)/gm, '<li>$1</li>')
        .replace(/((?:CORR|CASE|TKT|BILL)-[A-Z0-9]+)/g, '<code>$1</code>')
        .replace(/(<li>.*<\/li>)+/gs, '<ul>$&</ul>')
        .replace(/^(?!<)/, '<p>')
        .replace(/(?<!>)$/, '</p>');
}

function showTyping() {
    const clone = typingTemplate.content.cloneNode(true);
    chatMessages.appendChild(clone);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
    chatMessages.querySelector('.typing-message')?.remove();
}

function setStatus(text, processing) {
    chatStatus.querySelector('.status-text').textContent = text;
    chatStatus.classList.toggle('processing', processing);
}

// ═══════════════════════════════════════════════════════════════
// Trace Functions
// ═══════════════════════════════════════════════════════════════

function addTraceEvent(event) {
    let agentClass = 'orchestrator';
    if (event.agent?.toLowerCase().includes('servicenow')) agentClass = 'servicenow';
    if (event.agent?.toLowerCase().includes('salesforce')) agentClass = 'salesforce';
    if (event.type === 'thinking') agentClass = 'thinking';

    const isComplete = event.status === 'complete';
    const isThinking = event.type === 'thinking';

    if (!isThinking) highlightArch(agentClass);

    const div = document.createElement('div');
    div.className = `trace-event ${agentClass}`;

    div.innerHTML = `
        <div class="trace-icon">${event.icon}</div>
        <div class="trace-body-content">
            <div class="trace-event-header">
                <span class="trace-agent">${event.agent}</span>
                <span class="trace-time">${event.timestamp}s</span>
            </div>
            <div class="trace-event-title">${escapeHtml(event.title)}</div>
            ${event.detail ? `<div class="trace-detail">${escapeHtml(event.detail)}</div>` : ''}
            ${event.data?.visual ? renderCard(event.data.visual) : ''}
            ${event.data ? `<div class="trace-expanded">${JSON.stringify(event.data, null, 2)}</div>` : ''}
        </div>
        <div class="trace-status ${isComplete ? 'complete' : ''}">
            ${isComplete ? '✓' : isThinking ? '💭' : '<div class="spinner"></div>'}
        </div>
    `;

    if (event.data) {
        div.addEventListener('click', () => div.classList.toggle('expanded'));
    }

    traceContent.appendChild(div);
    traceContent.scrollTop = traceContent.scrollHeight;

    // Update running events to complete
    if (event.type?.includes('end')) {
        traceContent.querySelectorAll(`.trace-event.${agentClass}:not(.expanded)`).forEach(el => {
            const status = el.querySelector('.trace-status');
            if (status && !status.classList.contains('complete')) {
                status.classList.add('complete');
                status.innerHTML = '✓';
            }
        });
    }
}

function renderCard(visual) {
    if (!visual) return '';

    const templates = {
        billing: `
            <div class="card-header">
                <span class="card-type">Billing Record</span>
                <span class="card-id">${visual.bill_id || ''}</span>
            </div>
            <div class="card-grid">
                <div class="card-field"><div class="card-label">Charged</div><div class="card-value error">${visual.amount}</div></div>
                <div class="card-field"><div class="card-label">Correct</div><div class="card-value success">${visual.correct_amount}</div></div>
                <div class="card-field"><div class="card-label">Code</div><div class="card-value">${visual.procedure_code}</div></div>
                <div class="card-field"><div class="card-label">Should Be</div><div class="card-value highlight">${visual.correct_code}</div></div>
            </div>
        `,
        insurance: `
            <div class="card-header">
                <span class="card-type">Insurance</span>
                <span class="card-id">${visual.plan}</span>
            </div>
            <div class="card-grid">
                <div class="card-field"><div class="card-label">Carrier</div><div class="card-value">${visual.carrier}</div></div>
                <div class="card-field"><div class="card-label">Status</div><div class="card-value success">${visual.status}</div></div>
                <div class="card-field"><div class="card-label">Coverage</div><div class="card-value highlight">${visual.coverage_rate}</div></div>
                <div class="card-field"><div class="card-label">Deductible</div><div class="card-value success">${visual.deductible_met ? 'Met' : 'Not Met'}</div></div>
            </div>
        `,
        correction: `
            <div class="card-header">
                <span class="card-type">Correction</span>
                <span class="card-id">${visual.correction_id}</span>
            </div>
            <div class="card-grid">
                <div class="card-field"><div class="card-label">Original</div><div class="card-value error">${visual.original_amount}</div></div>
                <div class="card-field"><div class="card-label">Corrected</div><div class="card-value success">${visual.corrected_amount}</div></div>
                <div class="card-field"><div class="card-label">Savings</div><div class="card-value highlight">${visual.savings}</div></div>
                <div class="card-field"><div class="card-label">Timeline</div><div class="card-value">${visual.timeline}</div></div>
            </div>
        `,
        case: `
            <div class="card-header">
                <span class="card-type">Case</span>
                <span class="card-id">${visual.case_id}</span>
            </div>
            <div class="card-grid">
                <div class="card-field"><div class="card-label">Status</div><div class="card-value highlight">${visual.status}</div></div>
                <div class="card-field"><div class="card-label">Priority</div><div class="card-value">${visual.priority}</div></div>
            </div>
        `
    };

    return templates[visual.type] ? `<div class="visual-card">${templates[visual.type]}</div>` : '';
}

// ═══════════════════════════════════════════════════════════════
// Metrics
// ═══════════════════════════════════════════════════════════════

function showMetrics(metrics) {
    metricsPanel.style.display = 'flex';

    metricTime.textContent = `${metrics.total_time}s`;
    metricTokens.textContent = metrics.tokens.input + metrics.tokens.output;
    metricCost.textContent = `$${metrics.estimated_cost.toFixed(4)}`;

    const t = metrics.timings || {};
    const total = metrics.total_time || 1;

    timingBar.innerHTML = `
        <div class="timing-bar-inner">
            <div class="timing-segment orchestrator" style="width: ${((t.orchestrator || 0) / total * 100).toFixed(0)}%"></div>
            <div class="timing-segment servicenow" style="width: ${((t.servicenow || 0) / total * 100).toFixed(0)}%"></div>
            <div class="timing-segment salesforce" style="width: ${((t.salesforce || 0) / total * 100).toFixed(0)}%"></div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// Architecture Diagram
// ═══════════════════════════════════════════════════════════════

function highlightArch(agent) {
    [archOrchestrator, archServicenow, archSalesforce].forEach(n => n?.classList.remove('active'));
    [archLine1, archLine2].forEach(l => l?.classList.remove('active'));

    switch (agent) {
        case 'orchestrator':
            archOrchestrator?.classList.add('active');
            break;
        case 'servicenow':
            archServicenow?.classList.add('active');
            archLine1?.classList.add('active');
            break;
        case 'salesforce':
            archSalesforce?.classList.add('active');
            archLine2?.classList.add('active');
            break;
    }
}

function resetArch() {
    setTimeout(() => {
        [archOrchestrator, archServicenow, archSalesforce].forEach(n => n?.classList.remove('active'));
        [archLine1, archLine2].forEach(l => l?.classList.remove('active'));
    }, 1500);
}

// ═══════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getWelcomeMessage() {
    return `
        <div class="message assistant">
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="message-header">Health Assistant</div>
                <div class="message-text">
                    <p>Hello! I'm your MidAtlantic Health virtual assistant. I can help you with:</p>
                    <ul>
                        <li><strong>Billing questions</strong> - Review charges, dispute errors, request corrections</li>
                        <li><strong>Insurance verification</strong> - Check coverage, deductibles, and benefits</li>
                        <li><strong>Appointments</strong> - Schedule, reschedule, or cancel visits</li>
                    </ul>
                    <p>How can I assist you today?</p>
                </div>
            </div>
        </div>
    `;
}

function getEmptyTrace() {
    return `
        <div class="trace-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
            </svg>
            <p>Agent activity will appear here</p>
        </div>
    `;
}

// Focus input on load
messageInput?.focus();
