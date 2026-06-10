// State Management
let state = {
    messages: [],
    totalActions: 0,
    sessionStartTime: Date.now(),
    theme: 'dark',
    isThinking: false
};

// DOM Elements
const htmlEl = document.documentElement;
const themeToggleBtn = document.getElementById('theme-toggle');
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const messagesContainer = document.getElementById('messages-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const welcomeScreen = document.getElementById('welcome-screen');
const uptimeCounter = document.getElementById('uptime-counter');
const totalActionsEl = document.getElementById('total-actions');
const toastNotification = document.getElementById('toast-notification');

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initTheme();
    initMessages();
    setupEventListeners();
    startUptimeCounter();
    adjustTextareaHeight();
});

// Load settings from localStorage
function loadSettings() {
    state.theme = localStorage.getItem('sia_theme') || localStorage.getItem('aura_theme') || 'dark';
    state.totalActions = parseInt(localStorage.getItem('sia_total_actions') || localStorage.getItem('aura_total_actions') || '0');
    totalActionsEl.textContent = state.totalActions;
}

// Theme Handling
function initTheme() {
    htmlEl.setAttribute('data-theme', state.theme);
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    htmlEl.setAttribute('data-theme', state.theme);
    localStorage.setItem('sia_theme', state.theme);
    showToast(`Switched to ${state.theme} theme`);
}

// Chat Session Handling
function initMessages() {
    const savedMessages = localStorage.getItem('sia_messages') || localStorage.getItem('aura_messages');
    if (savedMessages) {
        state.messages = JSON.parse(savedMessages);
        if (state.messages.length > 0) {
            welcomeScreen.style.display = 'none';
            state.messages.forEach(msg => {
                appendMessageToUI(msg.role, msg.content, false);
            });
            scrollToBottom();
        }
    }
}

function saveMessages() {
    localStorage.setItem('sia_messages', JSON.stringify(state.messages));
}

function clearChat() {
    state.messages = [];
    state.totalActions = 0;
    localStorage.removeItem('sia_messages');
    localStorage.removeItem('aura_messages');
    localStorage.setItem('sia_total_actions', '0');
    localStorage.setItem('aura_total_actions', '0');
    totalActionsEl.textContent = '0';
    
    // Clear UI
    messagesContainer.innerHTML = '';
    messagesContainer.appendChild(welcomeScreen);
    welcomeScreen.style.display = 'block';
    
    showToast('Chat history cleared');
}

// Event Listeners Setup
function setupEventListeners() {
    // Theme Toggle
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Sidebar Mobile Toggle
    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar if user clicks outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && 
            !sidebar.contains(e.target) && 
            !sidebarToggleBtn.contains(e.target) && 
            sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });

    // Clear Chat
    clearChatBtn.addEventListener('click', clearChat);

    // Textarea auto-resize
    chatInput.addEventListener('input', adjustTextareaHeight);

    // Send Message events
    sendBtn.addEventListener('click', submitMessage);
    
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitMessage();
        }
    });

    // Suggestions Click
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.getAttribute('data-prompt');
            chatInput.value = prompt;
            adjustTextareaHeight();
            submitMessage();
        });
    });

    // Handle Collapsing Execution Logs (dynamic delegation)
    messagesContainer.addEventListener('click', (e) => {
        const header = e.target.closest('.execution-header');
        if (header) {
            const logContainer = header.closest('.execution-log');
            logContainer.classList.toggle('collapsed');
        }
    });
}

// Auto-grow Textarea
function adjustTextareaHeight() {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
    if (chatInput.value === '') {
        chatInput.style.height = 'auto';
    }
}

// Toast System
function showToast(message) {
    toastNotification.textContent = message;
    toastNotification.classList.add('show');
    setTimeout(() => {
        toastNotification.classList.remove('show');
    }, 3000);
}

// Uptime Ticker
function startUptimeCounter() {
    setInterval(() => {
        const diff = Date.now() - state.sessionStartTime;
        const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        uptimeCounter.textContent = `${hours}:${minutes}:${seconds}`;
    }, 1000);
}

// Increment Action Counter
function incrementActions() {
    state.totalActions += 1;
    totalActionsEl.textContent = state.totalActions;
    localStorage.setItem('sia_total_actions', state.totalActions);
}

// Markdown Parser Helper
function parseMarkdown(text) {
    if (!text) return '';
    let html = text;

    // Escaping simple HTML tags to prevent XSS while allowing markdown layout
    html = html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Code Blocks (Triple Backticks)
    html = html.replace(/```(?:[a-zA-Z0-9]+)?\n([\s\S]*?)\n```/g, (match, code) => {
        return `<pre><code>${code}</code></pre>`;
    });

    // Inline Code (Single Backtick)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold (**text**)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Bullet points (leading dash or asterisk)
    html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    // Clean nested duplicate lists that regex might generate
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Ordered Lists
    html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
        if (match.includes('<ul>')) return match; // skip if already UL
        return `<ol>${match}</ol>`;
    });
    html = html.replace(/<\/ol>\s*<ol>/g, '');

    // Headers
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Newlines to breaks (except inside pre/lists)
    // Replace newlines that are not enclosed in pre/ul/ol/li with <br>
    html = html.replace(/\n/g, '<br>');
    
    // Clean up br tags inside lists and blocks
    html = html.replace(/<(ul|ol|pre|li|h1|h2|h3|h4)><br>/g, '<$1>');
    html = html.replace(/<br><\/(ul|ol|pre|li|h1|h2|h3|h4)>/g, '</$1>');

    return html;
}

// Append message to Chat View
function appendMessageToUI(role, content, animate = true) {
    // Hide welcome screen if showing
    if (welcomeScreen.style.display !== 'none') {
        welcomeScreen.style.display = 'none';
    }

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', role);
    if (!animate) {
        messageDiv.style.opacity = '1';
        messageDiv.style.transform = 'translateY(0)';
    }

    const avatar = role === 'user' ? '👤' : '🤖';
    const bubbleContent = role === 'user' ? parseMarkdown(content) : parseMarkdown(content);

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-bubble">${bubbleContent}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    return messageDiv;
}

// Scroll feed to bottom
function scrollToBottom() {
    messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth'
    });
}

// Simulate Agent Thinking Steps
function getSimulatedSteps(prompt) {
    const steps = ["🧠 Routing query to Google Gemini Engine..."];
    const text = prompt.toLowerCase();

    if (text.includes('email') || text.includes('gmail') || text.includes('send') || text.includes('inbox')) {
        steps.push("📧 Authenticating Gmail Tools API...");
        steps.push("📧 Drafting/Fetching email content...");
    }
    if (text.includes('doc') || text.includes('document') || text.includes('write') || text.includes('draft')) {
        steps.push("📝 Connecting to Google Workspace Documents...");
        steps.push("📝 Preparing document payload...");
    }
    if (text.includes('expense') || text.includes('money') || text.includes('sheet') || text.includes('spend')) {
        steps.push("📊 Accessing Google Sheets Expense Tracker Ledger...");
        steps.push("📊 Synchronizing expense calculation...");
    }
    if (text.includes('search') || text.includes('find') || text.includes('who') || text.includes('what') || text.includes('news')) {
        steps.push("🔍 Initializing SerpApi Web Search Engine...");
        steps.push("🔍 Scraping and compiling online web search results...");
    }
    if (text.includes('task') || text.includes('todo') || text.includes('reminder') || text.includes('meeting') || text.includes('calendar')) {
        steps.push("⏱️ Syncing with Google Calendar/Tasks Manager...");
        steps.push("⏱️ Updating schedules and task queues...");
    }

    steps.push("⚡ Finalizing payload and parsing response...");
    return steps;
}

// Message Submit Flow
async function submitMessage() {
    const userPrompt = chatInput.value.trim();
    if (!userPrompt || state.isThinking) return;

    state.isThinking = true;
    chatInput.value = '';
    adjustTextareaHeight();

    // 1. Add User Message
    state.messages.push({ role: 'user', content: userPrompt });
    saveMessages();
    appendMessageToUI('user', userPrompt);
    scrollToBottom();

    // 2. Prepare Assistant Message Node
    const assistantMessageNode = document.createElement('div');
    assistantMessageNode.classList.add('message', 'assistant');
    assistantMessageNode.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-bubble">
            <div class="execution-log">
                <div class="execution-header">
                    <span>⚙️ Agent Execution Log</span>
                    <span class="execution-header-icon">▼</span>
                </div>
                <div class="execution-steps" id="steps-container"></div>
            </div>
            <div class="assistant-actual-response" id="response-text-container" style="display:none; margin-top: 14px; border-top: 1px solid var(--border-glass); padding-top: 14px;">
                <div class="step-loader" style="display:inline-block; margin-right: 8px;"></div> Awaiting SIA Agent final execution response...
            </div>
        </div>
    `;
    messagesContainer.appendChild(assistantMessageNode);
    scrollToBottom();

    const stepsContainer = assistantMessageNode.querySelector('#steps-container');
    const responseContainer = assistantMessageNode.querySelector('#response-text-container');
    
    // 3. Initiate Agent Webhook API Call
    const apiCall = fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userPrompt }),
    });

    // 4. Simulate steps sequence sequentially
    const simulatedSteps = getSimulatedSteps(userPrompt);
    let stepIndex = 0;
    
    async function renderNextStep() {
        if (stepIndex < simulatedSteps.length) {
            // Mark previous step as success if exists
            if (stepIndex > 0) {
                const prevStepNode = stepsContainer.children[stepIndex - 1];
                const loader = prevStepNode.querySelector('.step-loader');
                if (loader) {
                    const checkmark = document.createElement('span');
                    checkmark.classList.add('step-success-icon');
                    checkmark.textContent = '✓';
                    loader.replaceWith(checkmark);
                }
            }

            // Append new step with loading spinner
            const stepItem = document.createElement('div');
            stepItem.classList.add('step-item');
            stepItem.innerHTML = `
                <div class="step-loader"></div>
                <span>${simulatedSteps[stepIndex]}</span>
            `;
            stepsContainer.appendChild(stepItem);
            scrollToBottom();

            stepIndex++;
            // Continue rendering next step
            setTimeout(renderNextStep, 600);
        } else {
            // Last step loader to success
            const prevStepNode = stepsContainer.children[stepIndex - 1];
            if (prevStepNode) {
                const loader = prevStepNode.querySelector('.step-loader');
                if (loader) {
                    const checkmark = document.createElement('span');
                    checkmark.classList.add('step-success-icon');
                    checkmark.textContent = '✓';
                    loader.replaceWith(checkmark);
                }
            }

            // Show active final response waiting indicator
            responseContainer.style.display = 'block';
            scrollToBottom();

            // Wait for backend API to finish
            try {
                const res = await apiCall;
                const data = await res.json();
                
                if (res.ok) {
                    const finalOutput = data.output;
                    responseContainer.innerHTML = parseMarkdown(finalOutput);
                    state.messages.push({ role: 'assistant', content: finalOutput });
                    saveMessages();
                } else {
                    const errorDetail = data.detail || 'An error occurred while running the agent.';
                    responseContainer.innerHTML = `<span style="color:var(--status-red)">⚠️ Error: ${errorDetail}</span>`;
                }
            } catch (err) {
                responseContainer.innerHTML = `<span style="color:var(--status-red)">⚠️ Connection Error: Failed to communicate with the FastAPI backend.</span>`;
            }

            // Collapse the execution log for neat UI once response is loaded
            const logContainer = assistantMessageNode.querySelector('.execution-log');
            logContainer.classList.add('collapsed');

            incrementActions();
            state.isThinking = false;
            scrollToBottom();
        }
    }

    // Trigger step loop
    renderNextStep();
}
