// MidAtlantic Health - Real-time Agent Activity Streaming

const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');
const traceContent = document.getElementById('traceContent');
const traceBadge = document.getElementById('traceBadge');
const resetButton = document.getElementById('resetButton');

// Architecture diagram elements
const archOrchestrator = document.getElementById('archOrchestrator');
const archServicenow = document.getElementById('archServicenow');
const archSalesforce = document.getElementById('archSalesforce');
const archLine1 = document.getElementById('archLine1');
const archLine2 = document.getElementById('archLine2');

let conversationId = null;
let isProcessing = false;

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
resetButton?.addEventListener('click', () => {
    if (isProcessing) return;
    conversationId = null;
    chatMessages.innerHTML = welcomeMessageHTML;
    traceContent.innerHTML = traceEmptyHTML;
    setTraceStatus('Ready', false);
    resetArchDiagram();
    messageInput.value = '';
    messageInput.focus();
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
    setTraceStatus('Running', true);
    highlightArchNode('orchestrator');

    try {
        // Use streaming endpoint
        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, conversation_id: conversationId })
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
            addTraceEvent(data.event);
            break;
        case 'response':
            typingIndicator.style.display = 'none';
            addMessage(data.text, 'assistant');
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
        .replace(/✅/g, '<span style="color: #10b981;">✅</span>')
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

    const isStart = event.type.includes('start');
    const statusClass = event.status === 'complete' ? 'complete' : 'running';

    // Highlight architecture
    highlightArchNode(agentClass);

    const eventDiv = document.createElement('div');
    eventDiv.className = `trace-event ${agentClass} ${statusClass}`;
    eventDiv.innerHTML = `
        <div class="trace-icon">${event.icon}</div>
        <div class="trace-body">
            <div class="trace-header">
                <span class="trace-agent">${event.agent}</span>
                <span class="trace-time">${event.timestamp}s</span>
            </div>
            <div class="trace-title">${escapeHtml(event.title)}</div>
            ${event.detail ? `<div class="trace-detail">${escapeHtml(event.detail)}</div>` : ''}
        </div>
        <div class="trace-status ${statusClass}">
            ${statusClass === 'running' ? '<div class="spinner"></div>' : '✓'}
        </div>
    `;

    traceContent.appendChild(eventDiv);
    traceContent.scrollTop = traceContent.scrollHeight;

    // If this is an end event, update the corresponding start event
    if (event.type.includes('end')) {
        const events = traceContent.querySelectorAll(`.trace-event.${agentClass}.running`);
        events.forEach(el => {
            el.classList.remove('running');
            el.classList.add('complete');
            const status = el.querySelector('.trace-status');
            if (status) status.innerHTML = '✓';
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
