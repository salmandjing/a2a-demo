// Multi-Agent Healthcare Demo
// Clean implementation with proper card rendering

const $ = id => document.getElementById(id);

// Elements
const chatArea = $('chatArea');
const msgInput = $('msgInput');
const sendBtn = $('sendBtn');
const resetBtn = $('resetBtn');
const jsonBtn = $('jsonBtn');
const jsonModal = $('jsonModal');
const modalClose = $('modalClose');
const jsonCode = $('jsonCode');
const traceList = $('traceList');
const traceStatus = $('traceStatus');
const metricsSection = $('metricsSection');
const mTime = $('mTime');
const mTokens = $('mTokens');
const mCost = $('mCost');
const timingVisual = $('timingVisual');

// Agents
const agentOrch = $('agentOrch');
const agentSN = $('agentSN');
const agentSF = $('agentSF');
const line1 = $('line1');
const line2 = $('line2');

// State
let sessionId = null;
let processing = false;
let traces = [];

// ══════════════════════════════════════════════════════════════
// Event Listeners
// ══════════════════════════════════════════════════════════════

resetBtn.addEventListener('click', async () => {
    if (processing) return;
    if (sessionId) {
        try { await fetch(`/api/session/${sessionId}`, { method: 'DELETE' }); } catch {}
    }
    sessionId = null;
    traces = [];
    chatArea.innerHTML = welcomeHTML();
    traceList.innerHTML = emptyTraceHTML();
    metricsSection.style.display = 'none';
    setStatus('Idle', false);
    clearAgents();
    msgInput.value = '';
    msgInput.focus();
});

jsonBtn.addEventListener('click', () => {
    if (traces.length === 0) return;
    jsonCode.textContent = JSON.stringify(traces, null, 2);
    jsonModal.classList.add('open');
});

modalClose.addEventListener('click', () => jsonModal.classList.remove('open'));
jsonModal.querySelector('.modal-overlay').addEventListener('click', () => jsonModal.classList.remove('open'));

msgInput.addEventListener('input', () => {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
    sendBtn.disabled = !msgInput.value.trim() || processing;
});

msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) send();
    }
});

sendBtn.addEventListener('click', send);

document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (processing) return;
        msgInput.value = btn.dataset.msg;
        msgInput.dispatchEvent(new Event('input'));
        send();
    });
});

// ══════════════════════════════════════════════════════════════
// Send Message
// ══════════════════════════════════════════════════════════════

async function send() {
    const msg = msgInput.value.trim();
    if (!msg || processing) return;

    processing = true;
    sendBtn.disabled = true;

    addMsg(msg, 'user');
    msgInput.value = '';
    msgInput.style.height = 'auto';

    showTyping();
    setStatus('Processing', true);

    traceList.innerHTML = '';
    traces = [];
    metricsSection.style.display = 'none';
    activateAgent('orch');

    try {
        const res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, session_id: sessionId })
        });

        const reader = res.body.getReader();
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
                        handleSSE(JSON.parse(line.slice(6)));
                    } catch {}
                }
            }
        }
    } catch (err) {
        console.error(err);
        hideTyping();
        addMsg('Sorry, something went wrong. Please try again.', 'assistant');
        setStatus('Error', false);
    }

    setTimeout(clearAgents, 1500);
    processing = false;
    sendBtn.disabled = !msgInput.value.trim();
}

function handleSSE(data) {
    switch (data.type) {
        case 'trace':
            traces.push(data.event);
            addTrace(data.event);
            break;
        case 'metrics':
            showMetrics(data.data);
            break;
        case 'response':
            hideTyping();
            addMsg(data.text, 'assistant');
            if (data.session_id) sessionId = data.session_id;
            setStatus('Complete', false);
            break;
        case 'error':
            hideTyping();
            addMsg('Error: ' + data.message, 'assistant');
            setStatus('Error', false);
            break;
    }
}

// ══════════════════════════════════════════════════════════════
// Chat
// ══════════════════════════════════════════════════════════════

function addMsg(text, role) {
    const div = document.createElement('div');
    div.className = `msg msg-${role}`;
    div.innerHTML = `<div class="msg-bubble">${role === 'assistant' ? format(text) : esc(text)}</div>`;
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function format(text) {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^- (.*?)(<br>|$)/gm, '<li>$1</li>')
        .replace(/((?:CORR|CASE|TKT|BILL)-[A-Z0-9]+)/g, '<code>$1</code>')
        .replace(/(<li>.*<\/li>)+/gs, '<ul>$&</ul>')
        .replace(/^(?!<)/, '<p>').replace(/(?<!>)$/, '</p>');
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'msg msg-assistant msg-typing';
    div.id = 'typingMsg';
    div.innerHTML = `<div class="msg-bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function hideTyping() {
    $('typingMsg')?.remove();
}

// ══════════════════════════════════════════════════════════════
// Trace
// ══════════════════════════════════════════════════════════════

function addTrace(ev) {
    let cls = 'orch';
    if (ev.agent?.toLowerCase().includes('servicenow')) cls = 'sn';
    if (ev.agent?.toLowerCase().includes('salesforce')) cls = 'sf';
    if (ev.type === 'thinking') cls = 'think';

    if (cls !== 'think') activateAgent(cls);

    const done = ev.status === 'complete';
    const thinking = ev.type === 'thinking';

    const div = document.createElement('div');
    div.className = `trace-item ${cls}`;
    div.innerHTML = `
        <div class="trace-top">
            <span class="trace-agent">${ev.agent}</span>
            <span class="trace-time">${ev.timestamp}s</span>
        </div>
        <div class="trace-title">
            ${esc(ev.title)}
            ${done ? '<span class="trace-check">✓</span>' : thinking ? '' : '<span class="trace-spinner"></span>'}
        </div>
        ${ev.detail ? `<div class="trace-detail">${esc(ev.detail)}</div>` : ''}
        ${ev.data?.visual ? card(ev.data.visual) : ''}
    `;

    traceList.appendChild(div);
    traceList.scrollTop = traceList.scrollHeight;

    // Mark previous items as complete
    if (ev.type?.includes('end')) {
        traceList.querySelectorAll(`.trace-item.${cls} .trace-spinner`).forEach(s => {
            s.outerHTML = '<span class="trace-check">✓</span>';
        });
    }
}

function card(v) {
    if (!v) return '';

    const tpl = {
        billing: `
            <div class="card-head">
                <span class="card-badge billing">Billing Issue</span>
                <span class="card-id">${v.bill_id||''}</span>
            </div>
            <div class="card-grid">
                <div class="card-stat">
                    <span class="stat-label">Billed Amount</span>
                    <span class="stat-value error">${v.amount}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">Correct Amount</span>
                    <span class="stat-value success">${v.correct_amount}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">Code Used</span>
                    <span class="stat-value mono">${v.procedure_code}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">Correct Code</span>
                    <span class="stat-value accent mono">${v.correct_code}</span>
                </div>
            </div>`,
        insurance: `
            <div class="card-head">
                <span class="card-badge insurance">Insurance</span>
                <span class="card-id">${v.plan}</span>
            </div>
            <div class="card-grid">
                <div class="card-stat">
                    <span class="stat-label">Carrier</span>
                    <span class="stat-value">${v.carrier}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">Status</span>
                    <span class="stat-value success">${v.status}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">Coverage Rate</span>
                    <span class="stat-value accent">${v.coverage_rate}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">Deductible</span>
                    <span class="stat-value ${v.deductible_met ? 'success' : 'warning'}">${v.deductible_met ? 'Met' : 'Not Met'}</span>
                </div>
            </div>`,
        correction: `
            <div class="card-head">
                <span class="card-badge correction">Correction</span>
                <span class="card-id">${v.correction_id}</span>
            </div>
            <div class="card-grid">
                <div class="card-stat">
                    <span class="stat-label">Original</span>
                    <span class="stat-value error">${v.original_amount}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">Corrected</span>
                    <span class="stat-value success">${v.corrected_amount}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">You Save</span>
                    <span class="stat-value accent">${v.savings}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">Timeline</span>
                    <span class="stat-value">${v.timeline}</span>
                </div>
            </div>`,
        case: `
            <div class="card-head">
                <span class="card-badge case">Support Case</span>
                <span class="card-id">${v.case_id}</span>
            </div>
            <div class="card-grid cols-3">
                <div class="card-stat">
                    <span class="stat-label">Status</span>
                    <span class="stat-value accent">${v.status}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">Priority</span>
                    <span class="stat-value ${v.priority === 'High' ? 'error' : ''}">${v.priority}</span>
                </div>
                <div class="card-stat">
                    <span class="stat-label">Assigned To</span>
                    <span class="stat-value">${v.team}</span>
                </div>
            </div>`
    };

    return tpl[v.type] ? `<div class="data-card ${v.type}">${tpl[v.type]}</div>` : '';
}

// ══════════════════════════════════════════════════════════════
// Metrics
// ══════════════════════════════════════════════════════════════

function showMetrics(m) {
    metricsSection.style.display = 'block';
    mTime.textContent = `${m.total_time}s`;
    mTokens.textContent = m.tokens.input + m.tokens.output;
    mCost.textContent = `$${m.estimated_cost.toFixed(4)}`;

    const t = m.timings || {};
    const total = m.total_time || 1;
    const pOrch = ((t.orchestrator || 0) / total * 100).toFixed(0);
    const pSN = ((t.servicenow || 0) / total * 100).toFixed(0);
    const pSF = ((t.salesforce || 0) / total * 100).toFixed(0);

    timingVisual.innerHTML = `
        <div class="timing-seg orch" style="width:${pOrch}%"></div>
        <div class="timing-seg sn" style="width:${pSN}%"></div>
        <div class="timing-seg sf" style="width:${pSF}%"></div>
    `;
}

// ══════════════════════════════════════════════════════════════
// Agents
// ══════════════════════════════════════════════════════════════

function activateAgent(which) {
    [agentOrch, agentSN, agentSF].forEach(a => a?.classList.remove('active'));
    [line1, line2].forEach(l => l?.classList.remove('active'));

    switch (which) {
        case 'orch': agentOrch?.classList.add('active'); break;
        case 'sn': agentSN?.classList.add('active'); line1?.classList.add('active'); break;
        case 'sf': agentSF?.classList.add('active'); line2?.classList.add('active'); break;
    }
}

function clearAgents() {
    [agentOrch, agentSN, agentSF].forEach(a => a?.classList.remove('active'));
    [line1, line2].forEach(l => l?.classList.remove('active'));
}

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function setStatus(txt, active) {
    traceStatus.querySelector('.status-text').textContent = txt;
    traceStatus.classList.toggle('active', active);
}

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function welcomeHTML() {
    return `<div class="msg msg-assistant"><div class="msg-bubble">
        <p><strong>Welcome to MidAtlantic Health!</strong></p>
        <p>I'm your AI assistant. I can help with:</p>
        <ul><li>Billing questions & disputes</li><li>Insurance verification</li><li>Appointment scheduling</li></ul>
        <p>Try the demo scenarios on the left, or type your own question.</p>
    </div></div>`;
}

function emptyTraceHTML() {
    return `<div class="trace-empty">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>
        <p>Agent activity will appear here</p>
        <p class="empty-hint">Click a demo scenario to start</p>
    </div>`;
}

// Init
msgInput.focus();
