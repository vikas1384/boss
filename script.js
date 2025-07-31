// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatMessages = document.getElementById('chat-messages');
    const userMessageInput = document.getElementById('user-message');
    const sendButton = document.getElementById('send-btn');
    const languageSelector = document.getElementById('language');
    const reportContent = document.getElementById('report-content');
    const downloadPdfButton = document.getElementById('download-pdf');
    const emergencyModal = document.getElementById('emergency-modal');
    const closeModalButton = document.querySelector('.close-modal');
    const callEmergencyButton = document.getElementById('call-emergency');
    const closeAlertButton = document.getElementById('close-alert');

    // API Keys - Will be fetched from server
    let GROQ_API_KEY = '';
    let PERPLEXITY_API_KEY = '';
    let GEMINI_API_KEY = '';
    
    // Fetch API keys from server
    async function fetchAPIKeys() {
        try {
            // In development/local environment, the server might not be running
            // So we'll use a fallback mechanism to handle both scenarios
            const response = await fetch('/api/keys', { method: 'GET' })
                .catch(() => {
                    console.log('Using default API keys (local development)');
                    return { ok: false };
                });
            
            if (response.ok) {
                const keys = await response.json();
                GROQ_API_KEY = keys.groq || GROQ_API_KEY;
                PERPLEXITY_API_KEY = keys.perplexity || PERPLEXITY_API_KEY;
                GEMINI_API_KEY = keys.gemini || GEMINI_API_KEY;
            }
            // If fetch fails, we'll continue with the hardcoded keys
        } catch (error) {
            console.error('Error fetching API keys:', error);
            // Continue with default keys
        }
    }

    // Application State
const state = {
    conversation: [],
    currentLanguage: 'english',
    userName: '',
    userLocation: '',
    userAge: '',
    userGender: '',
    symptomData: {},
    assessmentComplete: false,
    reportGenerated: false,
    emergencyDetected: false,
    pendingPdfGeneration: false,
    autoGeneratingPDF: false
};

    // Emergency Keywords
    const emergencyKeywords = [
        'chest pain', 'heart attack', 'stroke', 'unconscious', 'unconsciousness',
        'not breathing', 'trouble breathing', 'difficulty breathing', 'severe bleeding',
        'uncontrolled bleeding', 'seizure', 'seizures', 'suicide', 'poisoning'
    ];

    // Initialize the chat with a welcome message
    async function initChat() {
        // Fetch API keys first
        await fetchAPIKeys();
        
        // Verify PDF libraries are loaded correctly
        console.log('Verifying PDF libraries on initialization...');
        
        // Ensure libraries are loaded with a delay to allow scripts to initialize
        setTimeout(async () => {
            // Check if both libraries are loaded properly
            if (!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas) {
                console.log('PDF libraries not fully loaded during initialization, attempting to load them now...');
                
                // Use our improved loadPdfLibraries function which returns a promise
                const librariesLoaded = await loadPdfLibraries();
                
                if (!librariesLoaded) {
                    console.warn('PDF libraries failed to load. PDF functionality may be limited.');
                    // Update the download button to indicate potential issues
                    const downloadBtn = document.getElementById('download-pdf');
                    if (downloadBtn) {
                        downloadBtn.innerHTML = '<i class="fas fa-download"></i> Try PDF Download';
                    }
                    // Make the text download option more prominent
                    const textBtn = document.getElementById('download-text');
                    if (textBtn) {
                        textBtn.style.fontWeight = 'bold';
                        textBtn.innerHTML = '<i class="fas fa-file-alt"></i> Download Text Report (Recommended)';
                    }
                } else {
                    console.log('All PDF libraries successfully loaded');
                }
            } else {
                console.log('All PDF libraries successfully verified during initialization');
            }
        }, 1000); // Added delay to ensure scripts are fully loaded
        
        addAIMessage("Hi, I'm Dr. Arogya, your health companion. Tell me what's bothering you today?");
    }
    
    // Function to load PDF libraries if they're not loaded properly
function loadPdfLibraries() {
    console.log('Attempting to load PDF libraries...');
    
    // Create a promise to track when both libraries are loaded
    return new Promise((resolve) => {
        // Function to check if both libraries are loaded
        const checkLibraries = () => {
            // Check if jsPDF is available in any of the possible locations
            const jsPdfAvailable = (
                (window.jspdf && window.jspdf.jsPDF) || 
                (window.jsPDF) || 
                (typeof jspdf !== 'undefined' && jspdf.jsPDF)
            );
            
            // Check if html2canvas is available
            const html2canvasAvailable = (
                window.html2canvas || 
                (typeof html2canvas !== 'undefined')
            );
            
            console.log('Library check:', {
                jsPdfAvailable,
                html2canvasAvailable
            });
            
            if (jsPdfAvailable && html2canvasAvailable) {
                // Make sure jspdf is available in the expected location
                if (!window.jspdf && typeof jspdf !== 'undefined') {
                    window.jspdf = jspdf;
                    console.log('Set window.jspdf from global jspdf');
                } else if (!window.jspdf && window.jsPDF) {
                    window.jspdf = { jsPDF: window.jsPDF };
                    console.log('Set window.jspdf from window.jsPDF');
                }
                
                // Make sure html2canvas is available in the expected location
                if (!window.html2canvas && typeof html2canvas !== 'undefined') {
                    window.html2canvas = html2canvas;
                    console.log('Set window.html2canvas from global html2canvas');
                }
                
                console.log('Both libraries loaded successfully');
                resolve(true);
                return true;
            }
            return false;
        };
        
        // Check immediately if both libraries are already loaded
        if (checkLibraries()) return;
        
        // Try to load from CDN with fallbacks
        const loadScript = (url, callback) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = callback;
            script.onerror = (e) => {
                console.error(`Failed to load script from ${url}`, e);
                if (url.includes('cdnjs')) {
                    // Try unpkg as fallback
                    const unpkgUrl = url.replace(
                        'cdnjs.cloudflare.com/ajax/libs',
                        'unpkg.com'
                    ).replace('@2.5.1/jspdf.umd.min.js', '@2.5.1/dist/jspdf.umd.min.js');
                    console.log(`Trying fallback URL: ${unpkgUrl}`);
                    loadScript(unpkgUrl, callback);
                } else if (url.includes('unpkg')) {
                    // Try jsdelivr as second fallback
                    const jsdelivrUrl = url.replace(
                        'unpkg.com',
                        'cdn.jsdelivr.net/npm'
                    );
                    console.log(`Trying second fallback URL: ${jsdelivrUrl}`);
                    loadScript(jsdelivrUrl, callback);
                }
            };
            document.head.appendChild(script);
        };
        
        // Load jsPDF
        if (!window.jspdf || !window.jspdf.jsPDF) {
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', () => {
                console.log('jsPDF script loaded');
                // Try to make jsPDF available globally
                if (typeof jspdf !== 'undefined') {
                    window.jspdf = jspdf;
                    console.log('Set jspdf from global scope');
                }
                checkLibraries();
            });
        }
        
        // Load html2canvas
        if (!window.html2canvas) {
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', () => {
                console.log('html2canvas script loaded');
                // Try to make html2canvas available globally
                if (typeof html2canvas !== 'undefined') {
                    window.html2canvas = html2canvas;
                    console.log('Set html2canvas from global scope');
                }
                checkLibraries();
            });
        }
        
        // Double check after a delay in case onload events don't fire correctly
        setTimeout(() => {
            console.log('Verifying libraries after loading attempt:', {
                jspdf: window.jspdf ? 'Loaded' : 'Not loaded',
                jsPDF: window.jspdf && window.jspdf.jsPDF ? 'Loaded' : 'Not loaded',
                html2canvas: window.html2canvas ? 'Loaded' : 'Not loaded'
            });
            
            // Final check and fallback
            if (!checkLibraries()) {
                console.warn('Libraries failed to load after timeout, resolving with failure');
                resolve(false);
            } else if (state.pendingPdfGeneration) {
                console.log('Libraries verified, retrying PDF generation...');
                state.pendingPdfGeneration = false;
                generatePDF();
            }
        }, 2000);
    });
}

    // Event Listeners
    sendButton.addEventListener('click', handleUserMessage);
    userMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserMessage();
        }
    });

    languageSelector.addEventListener('change', (e) => {
        state.currentLanguage = e.target.value;
        translateInterface(state.currentLanguage);
    });

    downloadPdfButton.addEventListener('click', async function(e) {
        // Check if PDF libraries are loaded
        if (window.jspdf && window.jspdf.jsPDF && window.html2canvas) {
            generatePDF();
        } else {
            console.warn('PDF libraries not loaded, attempting to load them now...');
            
            // Show loading message
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'loading-message';
            loadingMessage.textContent = 'Loading PDF libraries...';
            document.body.appendChild(loadingMessage);
            
            // Ask user if they want to try again or use alternative download
            if (confirm('PDF generation libraries need to be loaded. Would you like to continue?')) {
                // Use our improved loadPdfLibraries function which returns a promise
                const librariesLoaded = await loadPdfLibraries();
                
                // Remove loading message
                document.body.removeChild(loadingMessage);
                
                if (librariesLoaded) {
                    generatePDF();
                } else {
                    alert('PDF libraries could not be loaded. A text version will be downloaded instead.');
                    offerTextDownload();
                }
            } else {
                // Remove loading message
                document.body.removeChild(loadingMessage);
                
                // Offer a text download as fallback
                offerTextDownload();
            }
        }
    });
    closeModalButton.addEventListener('click', () => emergencyModal.style.display = 'none');
    closeAlertButton.addEventListener('click', () => emergencyModal.style.display = 'none');
    callEmergencyButton.addEventListener('click', callEmergencyServices);
    
    // Add event listener for text download button
    document.getElementById('download-text').addEventListener('click', offerTextDownload);

    // Handle user message submission
    function handleUserMessage() {
        const message = userMessageInput.value.trim();
        if (!message) return;

        // Add user message to chat
        addUserMessage(message);
        userMessageInput.value = '';

        // Check for emergency keywords
        if (checkForEmergency(message)) {
            state.emergencyDetected = true;
            showEmergencyAlert();
        }

        // Add message to conversation history
        state.conversation.push({ role: 'user', content: message });

        // Extract user info if not already collected
        extractUserInfo(message);

        // Check if we were waiting for user info after assessment and now have it
        if (state.assessmentComplete && !state.reportGenerated) {
            // Extract user info from the current message
            extractUserInfo(message);
            
            // Check if we now have all required information
            if (state.userName && state.userAge && state.userGender) {
                // Find the assessment response in the conversation history
                for (let i = state.conversation.length - 1; i >= 0; i--) {
                    const entry = state.conversation[i];
                    if (entry.role === 'assistant' && 
                        (entry.content.includes('🧾 Symptom Summary') || 
                         entry.content.includes('🧠 Possible Non-Diagnostic Explanation'))) {
                        // Generate the report with the collected user information
                        updateReportContent(entry.content);
                        
                        // Confirm to the user that their report is ready and automatically generate PDF
                        setTimeout(() => {
                            const confirmMessage = `Thank you, ${state.userName}. Your medical report has been generated and is being downloaded automatically.`;
                            addAIMessage(confirmMessage);
                            state.conversation.push({ role: 'assistant', content: confirmMessage });
                            
                            // Automatically generate and download the PDF
                            setTimeout(() => {
                                // Set flag to indicate automatic PDF generation
                                state.autoGeneratingPDF = true;
                                generatePDF();
                                // Reset the flag after generation
                                setTimeout(() => {
                                    state.autoGeneratingPDF = false;
                                }, 1000);
                            }, 500);
                        }, 1000);
                        break;
                    }
                }
            } else {
                // If we still don't have all required info, remind the user what's missing
                let missingInfo = [];
                if (!state.userName) missingInfo.push("name");
                if (!state.userAge) missingInfo.push("age");
                if (!state.userGender) missingInfo.push("gender/sex");
                
                if (missingInfo.length > 0 && message.length < 50) {
                    // Only remind if the user's message is short (likely just answering with partial info)
                    setTimeout(() => {
                        const reminderMessage = `I still need your ${missingInfo.join(", ")} to complete your medical report. Please provide this information.`;
                        addAIMessage(reminderMessage);
                        state.conversation.push({ role: 'assistant', content: reminderMessage });
                    }, 1000);
                }
            }
        }

        // Process the message and get AI response
        processUserMessage(message);
    }

    // Process user message and generate AI response
    async function processUserMessage(message) {
        try {
            // Show typing indicator
            const typingIndicator = addTypingIndicator();

            // Prepare the prompt based on conversation stage
            let prompt;
            if (!state.assessmentComplete) {
                prompt = prepareSymptomAssessmentPrompt(message);
            } else {
                prompt = prepareFollowUpPrompt(message);
            }

            // Call the AI API
            const response = await callClaudeAPI(prompt);

            // Remove typing indicator
            removeTypingIndicator(typingIndicator);

            // Process and display the AI response
            processAIResponse(response);

        } catch (error) {
            console.error('Error processing message:', error);
            removeTypingIndicator();
            addAIMessage("I'm sorry, I encountered an error. Please try again.");
        }
    }

    // Call AI API for responses using GROQ
    async function callClaudeAPI(prompt) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'llama3-70b-8192',
                    messages: [
                        {
                            role: 'system',
                            content: `You are Dr. Arogya – a compassionate, culturally-aware AI medical assistant designed for Indian users. Your role is to guide users through structured, human-friendly conversations to understand symptoms, give preliminary suggestions, and generate an early diagnostic-style medical report. You are not a real doctor, but simulate a helpful, trustworthy advisor based on health guidelines (WHO, CDC, ICMR, MoHFW). Use regional empathy, multilingual tone (if applicable), and prioritize safety.

IMPORTANT: You MUST follow a strict two-phase approach:

## 1. SYMPTOM UNDERSTANDING PHASE

Engage the user like a friendly family doctor who listens with empathy. Your first goal is to extract full symptom context.

**Conversational Flow:**
- Start with a warm greeting: "Hi, I'm Dr. Arogya, your health companion. Tell me what's bothering you today?"
- Ask open-ended questions and respond based on their answers.
- Use conversational language (not robotic) and follow-up with:
  - Duration of symptoms?
  - Severity: mild/moderate/severe?
  - Frequency: daily/occasional/constant?
  - Any fever, recent travel, stress, weather exposure?
  - Age and gender?
  - Any existing conditions (BP, diabetes, asthma)?
  - Allergies or medications currently being taken?
  - Lifestyle indicators: food, water intake, work hours, exercise

**Emergency Detection Algorithm:**
- Detect red flags like:
  - chest pain
  - unconsciousness
  - trouble breathing
  - uncontrolled bleeding
  - seizures
- If found, immediately respond with:
  "⚠️ This could be an emergency. Please visit a hospital or call a medical professional immediately."

**Context-Aware Logic:**
- Adapt tone for children, elderly, pregnant women
- If symptoms are vague or multiple, ask structured follow-ups to isolate possible areas (headache + nausea, cough + fever, etc.)
- Acknowledge emotions, e.g. "That sounds uncomfortable. Let's figure this out together."

## 2. COMPLETE RECOMMENDATION PHASE

After collecting enough symptom data, begin generating helpful suggestions. This is **not a diagnosis**, just support and lifestyle suggestions.

Do not use asterisk (*) symbols in your responses. Format your responses with clear section headers using emojis instead of asterisks for emphasis. Follow this template for complete assessments:

🧾 **Symptom Summary**
"Based on what you've shared, here's a quick summary…"

🧠 **Possible Non-Diagnostic Explanation**
"This might be related to [e.g. dehydration, viral fever, acidity, anxiety], but it's not a medical diagnosis."

🧘 **Lifestyle Guidance**
"Try to rest, hydrate, and monitor symptoms. Avoid spicy food or screen exposure if applicable."

🌿 **दादी माँ का नुस्खा**
Offer helpful Indian home remedies where applicable.
Example: "Tulsi ginger tea may help soothe throat irritation."

📅 **When to See a Doctor**
"If the symptom lasts beyond 2-3 days, or worsens, please consult a certified doctor."

🔒 **Safety Disclaimer**
"This is not a replacement for a licensed medical opinion. Always consult a real doctor for serious or persistent conditions."`
                        },
                        ...state.conversation
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            const data = await response.json();
            // Remove any asterisks that might still be in the response
            const cleanedContent = data.choices[0].message.content.replace(/\*/g, '');
            return cleanedContent;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Process AI response
    function processAIResponse(response) {
        // Add the response to conversation history
        state.conversation.push({ role: 'assistant', content: response });

        // Check if this is a complete assessment response with all required sections
        if (response.includes('🧾 Symptom Summary') && 
            response.includes('🧠 Possible Non-Diagnostic Explanation') &&
            response.includes('🧘 Lifestyle Guidance')) {
            state.assessmentComplete = true;
            
            // Always prompt for user information after final consultation
            promptForUserInfo();
        }

        // Display the message in the chat
        addAIMessage(response);

        // Scroll to the bottom of the chat
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Prompt user for information needed for the medical report
    function promptForUserInfo() {
        // Always ask for all information to ensure the report is complete and accurate
        const promptMessage = `Thank you for sharing your health concerns. To generate your professional medical report, I need the following information:

1. Your full name
2. Your age
3. Your gender/sex
4. Your location (optional)

Please provide this information so I can create a personalized medical report for you.`;
        
        // Add this as an AI message
        addAIMessage(promptMessage);
        state.conversation.push({ role: 'assistant', content: promptMessage });
        
        // Reset user info to ensure fresh data for the report
        state.userName = '';
        state.userAge = '';
        state.userGender = '';
        state.userLocation = '';
    }

    // Update the report content with the assessment - Doctor-friendly version
    function updateReportContent(response) {
        // Clear placeholder text
        reportContent.innerHTML = '';

        // Remove any asterisk symbols from the response
        response = response.replace(/\*/g, '');

        // Make the report container visible
        document.getElementById('report-container').style.display = 'flex';
        
        // Update the download button text to make it more clear
        document.getElementById('download-pdf').innerHTML = '<i class="fas fa-download"></i> Download Medical Report (PDF)';

        // Create report header with professional styling
        const reportHeader = document.createElement('div');
        reportHeader.className = 'report-section patient-info';
        reportHeader.innerHTML = `
            <h3>Patient Information</h3>
            <p><strong>Name:</strong> ${state.userName || 'Anonymous User'}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
            <p><strong>Report ID:</strong> AR-${generateReportId()}</p>
            <p><strong>Age:</strong> ${state.userAge || 'Not provided'}</p>
            <p><strong>Gender:</strong> ${state.userGender || 'Not provided'}</p>
            ${state.userLocation ? `<p><strong>Location:</strong> ${state.userLocation}</p>` : ''}
        `;
        reportContent.appendChild(reportHeader);

        // Parse and format the assessment sections with improved styling
        const sections = [
            { marker: '🧾 Symptom Summary', title: 'Symptom Summary', className: 'symptom-summary' },
            { marker: '🧾 **Symptom Summary**', title: 'Symptom Summary', className: 'symptom-summary' },
            { marker: '🧠 Possible Non-Diagnostic Explanation', title: 'Clinical Assessment', className: 'explanation' },
            { marker: '🧠 **Possible Non-Diagnostic Explanation**', title: 'Clinical Assessment', className: 'explanation' },
            { marker: '🧘 Lifestyle Guidance', title: 'Lifestyle Guidance', className: 'doctor-advice' },
            { marker: '🧘 **Lifestyle Guidance**', title: 'Lifestyle Guidance', className: 'doctor-advice' },
            { marker: '🌿 दादी माँ का नुस्खा', title: 'Supportive Care Measures', className: 'traditional-remedy' },
            { marker: '🌿 **दादी माँ का नुस्खा**', title: 'Supportive Care Measures', className: 'traditional-remedy' },
            { marker: '📅 When to See a Doctor', title: 'Medical Recommendations', className: 'doctor-advice' },
            { marker: '📅 **When to See a Doctor**', title: 'Medical Recommendations', className: 'doctor-advice' },
            { marker: '🔒 Safety Disclaimer', title: 'Medical Disclaimer', className: 'disclaimer' },
            { marker: '🔒 **Safety Disclaimer**', title: 'Medical Disclaimer', className: 'disclaimer' }
        ];

        // Group sections by title to handle multiple markers for the same section
        const sectionsByTitle = {};
        sections.forEach(section => {
            if (!sectionsByTitle[section.title]) {
                sectionsByTitle[section.title] = [];
            }
            sectionsByTitle[section.title].push(section.marker);
        });
        
        // Process each section type only once
        const processedSections = new Set();
        
        sections.forEach(section => {
            // Skip if we've already processed this section type
            if (processedSections.has(section.title)) {
                return;
            }
            
            // Check if any marker for this section exists in the response
            const markers = sectionsByTitle[section.title];
            let foundMarker = null;
            let startIndex = -1;
            
            for (const marker of markers) {
                const idx = response.indexOf(marker);
                if (idx >= 0 && (startIndex === -1 || idx < startIndex)) {
                    foundMarker = marker;
                    startIndex = idx;
                }
            }
            
            if (foundMarker) {
                let endIndex = response.length;
                
                // Find the end of this section (start of next section)
                for (const nextSectionTitle in sectionsByTitle) {
                    if (nextSectionTitle !== section.title) {
                        for (const nextMarker of sectionsByTitle[nextSectionTitle]) {
                            const nextSectionIndex = response.indexOf(nextMarker, startIndex + foundMarker.length);
                            if (nextSectionIndex > startIndex && nextSectionIndex < endIndex) {
                                endIndex = nextSectionIndex;
                            }
                        }
                    }
                }
                
                // Mark this section type as processed
                processedSections.add(section.title);

                // Extract and format the section content
                let sectionContent = response.substring(startIndex, endIndex).trim();
                sectionContent = sectionContent.replace(foundMarker, '');
                
                // Remove any remaining asterisks from section content
                sectionContent = sectionContent.replace(/\*/g, '');
                // Remove any markdown bold markers
                sectionContent = sectionContent.replace(/\*\*/g, '');

                const sectionElement = document.createElement('div');
                sectionElement.className = `report-section ${section.className}`;
                
                // Create section title with professional styling
                const sectionTitle = document.createElement('h3');
                sectionTitle.textContent = section.title;
                sectionElement.appendChild(sectionTitle);
                
                // Process content based on section type for better structure
                if (section.title === 'Symptom Summary' || section.title === 'Clinical Assessment') {
                    // For these sections, we want to preserve paragraph structure but format it better
                    const paragraphs = sectionContent.split('\n\n');
                    paragraphs.forEach(paragraph => {
                        if (paragraph.trim()) {
                            // Check if this is a list item
                            if (paragraph.trim().startsWith('-') || paragraph.trim().startsWith('*')) {
                                // Create a list for bullet points
                                const list = document.createElement('ul');
                                
                                // Split by line breaks and process each list item
                                const items = paragraph.split('\n');
                                items.forEach(item => {
                                    if (item.trim()) {
                                        const listItem = document.createElement('li');
                                        // Remove bullet character and trim
                                        listItem.textContent = item.trim().replace(/^[-*]\s*/, '');
                                        list.appendChild(listItem);
                                    }
                                });
                                
                                sectionElement.appendChild(list);
                            } else {
                                // Regular paragraph
                                const p = document.createElement('p');
                                p.textContent = paragraph.trim();
                                sectionElement.appendChild(p);
                            }
                        }
                    });
                } else {
                    // For other sections, create a more structured format
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'section-content';
                    contentDiv.textContent = sectionContent;
                    sectionElement.appendChild(contentDiv);
                }
                
                reportContent.appendChild(sectionElement);
            }
        });

        // Add emergency indicator if detected with prominent styling
        if (state.emergencyDetected) {
            const emergencyElement = document.createElement('div');
            emergencyElement.className = 'emergency-indicator';
            emergencyElement.innerHTML = `
                <p>⚠️ EMERGENCY WARNING: This may require immediate medical attention. Please contact emergency services or visit the nearest hospital immediately.</p>
            `;
            reportContent.appendChild(emergencyElement);
        }

        // Add professional disclaimer with improved styling
        const disclaimerElement = document.createElement('div');
        disclaimerElement.className = 'report-section disclaimer';
        disclaimerElement.innerHTML = `
            <h3>Medical Disclaimer</h3>
            <p><strong>Important:</strong> This report is generated by an AI system and is intended for informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical concerns.</p>
            <p style="font-size: 12px; color: #666; margin-top: 15px; text-align: right;">Generated by Arogya AI on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        `;
        reportContent.appendChild(disclaimerElement);

        // Mark report as generated
        state.reportGenerated = true;
    }

    // Function to offer text download as fallback when PDF generation fails
    function offerTextDownload() {
        try {
            // Create a text version of the report
            let textContent = 'AROGYA AI MEDICAL ASSESSMENT REPORT\n';
            textContent += '======================================\n\n';
            
            // Add patient information
            textContent += 'PATIENT INFORMATION:\n';
            textContent += `Name: ${state.userName || 'Not provided'}\n`;
            textContent += `Age: ${state.userAge || 'Not provided'}\n`;
            textContent += `Gender: ${state.userGender || 'Not provided'}\n`;
            textContent += `Date: ${new Date().toLocaleDateString()}\n`;
            textContent += `Time: ${new Date().toLocaleTimeString()}\n\n`;
            
            // Add report content
            const reportText = document.getElementById('report-content').innerText;
            textContent += reportText;
            
            // Add disclaimer
            textContent += '\n\nDISCLAIMER: This is not a replacement for a licensed medical opinion. '
            textContent += 'Always consult a real doctor for serious or persistent conditions.\n';
            
            // Create a blob and download link
            const blob = new Blob([textContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Medical_Report.txt';
            document.body.appendChild(a);
            a.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log('Text report downloaded successfully');
        } catch (error) {
            console.error('Error creating text download:', error);
            alert('Unable to generate report. Please try again later.');
        }
    }

    // Generate PDF from the report content - Doctor-friendly version
    function generatePDF() {
        console.log('Starting PDF generation process...');
        console.log('PDF libraries status:', {
            jspdf: window.jspdf ? 'Loaded' : 'Not loaded',
            jsPDF: window.jspdf && window.jspdf.jsPDF ? 'Loaded' : 'Not loaded',
            html2canvas: window.html2canvas ? 'Loaded' : 'Not loaded'
        });
        
        if (!state.assessmentComplete) {
            alert('Please complete a consultation first to generate a report.');
            console.log('PDF generation aborted: No assessment completed');
            return;
        }
        
        // If we have assessment but missing user info, prompt for it
        // Only check this when the button is clicked manually, not when called automatically
        if ((!state.userName || !state.userAge || !state.userGender) && !state.autoGeneratingPDF) {
            let missingInfo = [];
            if (!state.userName) missingInfo.push("name");
            if (!state.userAge) missingInfo.push("age");
            if (!state.userGender) missingInfo.push("gender/sex");
            
            // Show a more detailed prompt to the user
            const promptMessage = `To generate your professional medical report, please provide your ${missingInfo.join(", ")}. This information is essential for creating an accurate and personalized report.`;
            
            // Add this as an AI message in the chat
            addAIMessage(promptMessage);
            state.conversation.push({ role: 'assistant', content: promptMessage });
            
            console.log(`PDF generation waiting for user info: ${missingInfo.join(", ")}`);
            return;
        }
        
        // If report not yet generated but we have all info, generate it now
        if (!state.reportGenerated) {
            console.log('Report not yet generated, searching for assessment in conversation history...');
            // Find the assessment response in the conversation history
            let foundAssessment = false;
            for (let i = state.conversation.length - 1; i >= 0; i--) {
                const entry = state.conversation[i];
                if (entry.role === 'assistant' && 
                    (entry.content.includes('🧾 Symptom Summary') || 
                     entry.content.includes('🧠 Possible Non-Diagnostic Explanation'))) {
                    // Remove any asterisks from the content before updating the report
                    const cleanContent = entry.content.replace(/\*/g, '');
                    console.log('Assessment found in conversation history, updating report content...');
                    updateReportContent(cleanContent);
                    foundAssessment = true;
                    break;
                }
            }
            
            // If no assessment found in conversation history, show error
            if (!foundAssessment) {
                alert('Unable to generate report. Please complete a consultation first.');
                console.error('No assessment found in conversation history');
                return;
            }
        }

        try {
            // Show loading message
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'loading-message';
            loadingMessage.textContent = 'Preparing PDF generation...';
            document.body.appendChild(loadingMessage);
            
            console.log('Checking PDF libraries before generation...');
            // Check if libraries are loaded, if not, try to load them
            if (!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas) {
                console.error('PDF libraries not properly loaded, attempting to load them now...');
                loadingMessage.textContent = 'Loading PDF libraries...';
                
                // Use our improved loadPdfLibraries function which returns a promise
                state.pendingPdfGeneration = true;
                
                loadPdfLibraries().then(success => {
                    if (success) {
                        console.log('Libraries loaded successfully, continuing PDF generation');
                        state.pendingPdfGeneration = false;
                        // Remove loading message and restart PDF generation
                        document.body.removeChild(loadingMessage);
                        generatePDF();
                    } else {
                        // If libraries failed to load, offer text download as fallback
                        console.error('PDF libraries failed to load, offering text download');
                        document.body.removeChild(loadingMessage);
                        alert('PDF generation is currently unavailable. A text version of your report will be downloaded instead.');
                        offerTextDownload();
                    }
                });
                
                return;
            }
            
            console.log('PDF libraries verified, proceeding with PDF generation...');
            loadingMessage.textContent = 'Generating PDF...';
            
            // Make sure jsPDF is properly initialized
            if (!window.jspdf || !window.jspdf.jsPDF) {
                console.error('jsPDF not properly initialized, falling back to text download');
                document.body.removeChild(loadingMessage);
                alert('PDF generation failed. A text version of your report will be downloaded instead.');
                offerTextDownload();
                return;
            }
            
            // Update loading message
            loadingMessage.textContent = 'Generating PDF...';
            
            // Get jsPDF constructor
            const { jsPDF } = window.jspdf;
            
            // Create PDF in portrait mode with A4 dimensions (210 x 297 mm)
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            // Create a clone of the report content for PDF generation
            const reportClone = document.createElement('div');
            reportClone.id = 'report-clone';
            reportClone.style.position = 'absolute';
            reportClone.style.left = '-9999px';
            reportClone.style.width = '210mm'; // A4 width
            reportClone.style.backgroundColor = '#ffffff';
            reportClone.style.padding = '15mm';
            reportClone.style.boxSizing = 'border-box';
            reportClone.style.fontFamily = 'Arial, sans-serif';
            reportClone.innerHTML = reportContent.innerHTML;
            document.body.appendChild(reportClone);
            
            // Apply professional styling to the cloned report
            const reportSections = reportClone.querySelectorAll('.report-section');
            reportSections.forEach(section => {
                section.style.marginBottom = '10mm';
                section.style.pageBreakInside = 'avoid';
                section.style.clear = 'both';
            });
            
            // Style headings for better readability
            const headings = reportClone.querySelectorAll('h3');
            headings.forEach(heading => {
                heading.style.borderBottom = '1px solid #4285f4';
                heading.style.paddingBottom = '2mm';
                heading.style.marginBottom = '4mm';
                heading.style.color = '#4285f4';
                heading.style.fontSize = '14pt';
            });
            
            // Make patient info more compact and professional
            const patientInfoSection = reportClone.querySelector('.report-section:first-child');
            if (patientInfoSection) {
                const infoItems = patientInfoSection.querySelectorAll('p');
                infoItems.forEach(item => {
                    item.style.margin = '2mm 0';
                    item.style.fontSize = '10pt';
                });
            }
            
            // Add a professional letterhead
            const letterhead = document.createElement('div');
            letterhead.style.borderBottom = '2px solid #4285f4';
            letterhead.style.marginBottom = '10mm';
            letterhead.style.paddingBottom = '5mm';
            letterhead.style.textAlign = 'center';
            letterhead.innerHTML = `
                <h1 style="color: #4285f4; margin: 0; font-size: 18pt;">Arogya AI Health Assessment</h1>
                <p style="color: #666; margin: 2mm 0 0 0; font-size: 10pt;">AI-Generated Health Report | Confidential Medical Information</p>
            `;
            reportClone.insertBefore(letterhead, reportClone.firstChild);
            
            // Add a watermark to indicate this is an AI-generated report
            const watermark = document.createElement('div');
            watermark.style.position = 'absolute';
            watermark.style.top = '50%';
            watermark.style.left = '50%';
            watermark.style.transform = 'translate(-50%, -50%) rotate(-45deg)';
            watermark.style.fontSize = '24pt';
            watermark.style.color = 'rgba(200, 200, 200, 0.2)';
            watermark.style.pointerEvents = 'none';
            watermark.style.zIndex = '1000';
            watermark.style.width = '100%';
            watermark.style.textAlign = 'center';
            watermark.textContent = 'AI-GENERATED REPORT';
            reportClone.appendChild(watermark);
            
            console.log('Starting html2canvas rendering of professionally styled report...');
            
            // Optimize report content for single page
            const paragraphs = reportClone.querySelectorAll('p');
            paragraphs.forEach(p => {
                p.style.margin = '1mm 0';
                p.style.fontSize = '9pt';
                p.style.lineHeight = '1.2';
            });
            
            // Make headings more compact (update existing headings)
            headings.forEach(heading => {
                heading.style.fontSize = '12pt';
                heading.style.marginTop = '4mm';
                heading.style.marginBottom = '2mm';
                heading.style.paddingBottom = '1mm';
                // Override previous styles
                heading.style.borderBottom = '1px solid #4285f4';
                heading.style.color = '#4285f4';
            });
            
            // Reduce section spacing
            const sections = reportClone.querySelectorAll('.report-section');
            sections.forEach(section => {
                section.style.marginBottom = '5mm';
            });
            
            // Use html2canvas with better error handling
            window.html2canvas(reportClone, {
                scale: 2, // Higher quality
                useCORS: true, // Allow cross-origin images
                logging: true, // Enable logging for debugging
                backgroundColor: '#ffffff', // Ensure white background
                width: reportClone.offsetWidth,
                height: reportClone.offsetHeight
            }).then(canvas => {
                console.log('Canvas generated successfully, dimensions:', canvas.width, 'x', canvas.height);
                
                const imgData = canvas.toDataURL('image/png');
                const pageWidth = 210; // A4 width in mm
                const pageHeight = 297; // A4 height in mm
                const margin = 10; // margin in mm
                const imgWidth = pageWidth - (margin * 2);
                
                // Calculate height to maintain aspect ratio
                const imgHeight = canvas.height * imgWidth / canvas.width;
                
                // Check if content will fit on a single page
                const maxContentHeight = pageHeight - (margin * 2) - 20; // 20mm reserved for footer
                
                if (imgHeight > maxContentHeight) {
                    console.log('Content too large for single page, scaling down to fit...');
                    // Scale down to fit on a single page
                    const scaleFactor = maxContentHeight / imgHeight;
                    const scaledWidth = imgWidth * scaleFactor;
                    
                    // Center the scaled image horizontally
                    const horizontalOffset = margin + (imgWidth - scaledWidth) / 2;
                    
                    // Add the scaled image to fit on one page
                    doc.addImage(imgData, 'PNG', horizontalOffset, margin, scaledWidth, maxContentHeight);
                } else {
                    // Add the report image to the page (it already fits)
                    doc.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
                }
                
                // Add professional footer
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text('Page 1 of 1', pageWidth / 2, pageHeight - 5, { align: 'center' });
                
                // Add disclaimer footer
                doc.setFontSize(6);
                doc.setTextColor(150, 150, 150);
                doc.text('This is an AI-generated report and not a substitute for professional medical advice. Please consult a healthcare provider.', 
                         pageWidth / 2, pageHeight - 10, { align: 'center', maxWidth: pageWidth - 20 });
                
                // Add generation date
                doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 
                         margin, pageHeight - 5);
                
                // Remove temporary elements
                document.body.removeChild(reportClone);
                document.body.removeChild(loadingMessage);
                
                // Save the PDF with a professional filename
                const formattedDate = new Date().toISOString().split('T')[0];
                const fileName = state.userName ? 
                    `Medical_Report_${state.userName.replace(/\s+/g, '_')}_${formattedDate}.pdf` : 
                    `Medical_Report_${formattedDate}.pdf`;
                    
                doc.save(fileName);
                console.log('Professional single-page medical PDF report generated and saved successfully');
                
                // Show success message to user
                alert('Your medical report PDF has been generated and downloaded successfully.');
            }).catch(error => {
                console.error('Error generating PDF with html2canvas:', error);
                if (document.body.contains(loadingMessage)) {
                    document.body.removeChild(loadingMessage);
                }
                if (document.body.contains(reportClone)) {
                    document.body.removeChild(reportClone);
                }
                
                // Try fallback method
                try {
                    console.log('Attempting fallback PDF generation method...');
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF();
                    
                    // Add basic text content
                    doc.setFontSize(22);
                    doc.setTextColor(66, 133, 244);
                    doc.text('Arogya AI Health Assessment', 105, 20, { align: 'center' });
                    
                    doc.setFontSize(12);
                    doc.setTextColor(0, 0, 0);
                    doc.text('Patient Information', 20, 40);
                    doc.setFontSize(10);
                    doc.text(`Name: ${state.userName || 'Anonymous User'}`, 20, 50);
                    doc.text(`Age: ${state.userAge || 'Not provided'}`, 20, 60);
                    doc.text(`Gender: ${state.userGender || 'Not provided'}`, 20, 70);
                    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 80);
                    
                    // Save the PDF
                    const formattedDate = new Date().toISOString().split('T')[0];
                    const fileName = state.userName ? 
                        `Medical_Report_${state.userName.replace(/\s+/g, '_')}_${formattedDate}.pdf` : 
                        `Medical_Report_${formattedDate}.pdf`;
                    
                    doc.save(fileName);
                    console.log('Fallback PDF generation successful');
                    alert('Your medical report has been downloaded using a simplified format.');
                } catch (fallbackError) {
                    console.error('Fallback PDF generation also failed:', fallbackError);
                    alert('There was an error generating the PDF. Please try again or check your browser settings.');
                }
            });
        } catch (error) {
            console.error('Error in PDF generation process:', error);
            
            // Try the most basic fallback method
            try {
                console.log('Attempting basic fallback PDF generation...');
                if (window.jspdf && window.jspdf.jsPDF) {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF();
                    doc.text('Arogya AI Medical Report', 20, 20);
                    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 30);
                    
                    // Add some basic patient info
                    if (state.userName) doc.text(`Patient: ${state.userName}`, 20, 50);
                    if (state.userAge) doc.text(`Age: ${state.userAge}`, 20, 60);
                    if (state.userGender) doc.text(`Gender: ${state.userGender}`, 20, 70);
                    
                    // Save with simple filename
                    doc.save('Medical_Report.pdf');
                    console.log('Basic fallback PDF generation successful');
                    alert('A simplified version of your medical report has been downloaded.');
                } else {
                    throw new Error('jsPDF library not available for fallback');
                }
            } catch (fallbackError) {
                console.error('All PDF generation methods failed:', fallbackError);
                alert('There was an error generating the PDF. Please try again later or check your browser settings.');
            }
        }
    }

    // Check for emergency keywords in user message
    function checkForEmergency(message) {
        const lowerMessage = message.toLowerCase();
        return emergencyKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    // Show emergency alert modal
    function showEmergencyAlert() {
        emergencyModal.style.display = 'flex';
    }

    // Call emergency services
    function callEmergencyServices() {
        // In a real app, this would connect to emergency services
        // For demo purposes, we'll just provide information
        alert('In a real application, this would connect you to emergency services (102/108/112 in India).');
        window.location.href = 'tel:112';
    }

    // Extract user information from messages
    function extractUserInfo(message) {
        // Enhanced name extraction
        // We're not checking state.userName here because we want to update it if provided again
        const nameMatch = message.match(/my name is ([A-Za-z\s\.\-']+)/i) || 
                        message.match(/name[:\s]+([A-Za-z\s\.\-']+)/i) || 
                        message.match(/I am ([A-Za-z\s\.\-']+)/i) || 
                        message.match(/I'm ([A-Za-z\s\.\-']+)/i);
        if (nameMatch && nameMatch[1]) {
            const potentialName = nameMatch[1].trim();
            // Only accept as name if it's 2-30 characters and doesn't contain numbers
            if (potentialName.length >= 2 && potentialName.length <= 30 && !/\d/.test(potentialName)) {
                state.userName = potentialName;
            }
        } else if (message.length < 30 && /^[A-Za-z\s\.\-']+$/.test(message) && message.split(' ').length <= 4) {
            // If the message is just a short name by itself
            state.userName = message.trim();
        }

        // Enhanced age extraction
        const ageMatch = message.match(/I am (\d+) years old|I'm (\d+) years old|I'm (\d+)|I am (\d+)|age[:\s]+(\d+)|age[:\s]+is (\d+)|age (\d+)|^(\d+)$/i);
        if (ageMatch) {
            const age = ageMatch[1] || ageMatch[2] || ageMatch[3] || ageMatch[4] || ageMatch[5] || ageMatch[6] || ageMatch[7] || ageMatch[8];
            if (age) {
                const ageNum = parseInt(age);
                // Only accept reasonable ages
                if (ageNum > 0 && ageNum < 120) {
                    state.userAge = ageNum.toString();
                }
            }
        }

        // Enhanced gender extraction
        const lowerMessage = message.toLowerCase();
        // Check for male variations
        if (lowerMessage.includes(' male ') || lowerMessage.includes('i am male') || 
            lowerMessage.includes("i'm male") || lowerMessage.includes("gender male") || 
            lowerMessage.includes("gender: male") || lowerMessage.includes("sex male") || 
            lowerMessage.includes("sex: male") || lowerMessage === "male") {
            state.userGender = 'Male';
        } 
        // Check for female variations
        else if (lowerMessage.includes(' female ') || lowerMessage.includes('i am female') || 
                lowerMessage.includes("i'm female") || lowerMessage.includes("gender female") || 
                lowerMessage.includes("gender: female") || lowerMessage.includes("sex female") || 
                lowerMessage.includes("sex: female") || lowerMessage === "female") {
            state.userGender = 'Female';
        }
        // Check for other gender identities
        else if (lowerMessage.includes('non-binary') || lowerMessage.includes('nonbinary') || 
                lowerMessage.includes('non binary') || lowerMessage === "non-binary" || 
                lowerMessage === "nonbinary") {
            state.userGender = 'Non-binary';
        }
        else if (lowerMessage.includes('transgender') || lowerMessage.includes('trans') || 
                lowerMessage === "transgender" || lowerMessage === "trans") {
            state.userGender = 'Transgender';
        }
        else if (lowerMessage.includes('other') && 
                (lowerMessage.includes('gender') || lowerMessage.includes('sex'))) {
            state.userGender = 'Other';
        }

        // Enhanced location extraction
        const locationMatch = message.match(/I am from ([A-Za-z\s,\-\.]+)|I'm from ([A-Za-z\s,\-\.]+)|in ([A-Za-z\s,\-\.]+)|location[:\s]+([A-Za-z\s,\-\.]+)|live in ([A-Za-z\s,\-\.]+)|reside in ([A-Za-z\s,\-\.]+)/i);
        if (locationMatch) {
            const location = locationMatch[1] || locationMatch[2] || locationMatch[3] || locationMatch[4] || locationMatch[5] || locationMatch[6];
            if (location && location.trim().length >= 2 && location.trim().length <= 50) {
                state.userLocation = location.trim();
            }
        }
        
        // Log extracted information for debugging
        console.log('Extracted user info:', {
            name: state.userName,
            age: state.userAge,
            gender: state.userGender,
            location: state.userLocation
        });
    }

    // Generate a unique report ID
    function generateReportId() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    // Prepare prompt for symptom assessment phase
    function prepareSymptomAssessmentPrompt(message) {
        // Check if we have basic user information
        const needsUserInfo = !state.userName || !state.userAge || !state.userGender;
        
        return `The user has shared the following health concern: "${message}".
        
        IMPORTANT: You MUST follow the two-phase approach as described in your instructions:
        
        1. FIRST, engage in the SYMPTOM UNDERSTANDING PHASE. Ask open-ended questions about:
           - Duration of symptoms
           - Severity (mild/moderate/severe)
           - Frequency (daily/occasional/constant)
           - Related factors (fever, travel, stress, weather)
           ${needsUserInfo ? '- Basic information (name, age, gender/sex) which is essential for the health report' : ''}
           - Existing conditions, allergies, medications
           - Lifestyle factors
        
        2. ONLY after gathering sufficient information, proceed to the COMPLETE RECOMMENDATION PHASE with the structured format:
           - 🧾 Symptom Summary
           - 🧠 Possible Non-Diagnostic Explanation
           - 🧘 Lifestyle Guidance
           - 🌿 दादी माँ का नुस्खा (Traditional Remedy)
           - 📅 When to See a Doctor
           - 🔒 Safety Disclaimer
        
        Remember to NEVER use asterisk (*) symbols in your responses. Use the emoji section headers as specified in your instructions.
        
        IMPORTANT: Do NOT skip directly to recommendations without first gathering comprehensive symptom information.`;
    }

    // Prepare prompt for follow-up questions
    function prepareFollowUpPrompt(message) {
        return `The user has responded with: "${message}".
        
        Continue the conversation based on this response while maintaining the two-phase approach:
        
        1. If you are still in the SYMPTOM UNDERSTANDING PHASE and need more information:
           - Continue asking relevant follow-up questions
           - Gather any missing details about symptoms, duration, severity, etc.
           - Do NOT proceed to recommendations until you have comprehensive information
        
        2. If you have gathered sufficient information and are ready for the COMPLETE RECOMMENDATION PHASE:
           - Provide the complete structured response with all required sections
           - Use the emoji section headers as specified in your instructions
        
        3. If the user is asking for clarification after you've provided recommendations:
           - Address their specific questions
           - If they mention new symptoms, return to the Symptom Understanding Phase
           - If they're asking about specific treatments or medications, remind them that you cannot prescribe medications and they should consult a real doctor
        
        Remember to NEVER use asterisk (*) symbols in your responses and maintain the conversational, empathetic tone of a family doctor.`;
    }

    // Add user message to the chat
    function addUserMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.textContent = message;
        
        const timeElement = document.createElement('span');
        timeElement.className = 'message-time';
        timeElement.textContent = getCurrentTime();
        messageElement.appendChild(timeElement);
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Add AI message to the chat
    function addAIMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message ai-message';
        
        // Format message with emojis and sections
        let formattedMessage = message;
        
        // Remove asterisk (*) symbols from the message
        formattedMessage = formattedMessage.replace(/\*/g, '');
        
        // Replace section markers with styled versions
        const sectionMarkers = [
            '🧾 Symptom Summary',
            '🧠 Possible Non-Diagnostic Explanation',
            '🧘 Lifestyle Guidance',
            '🌿 दादी माँ का नुस्खा',
            '📅 When to See a Doctor',
            '🔒 Safety Disclaimer'
        ];
        
        sectionMarkers.forEach(marker => {
            if (formattedMessage.includes(marker)) {
                formattedMessage = formattedMessage.replace(
                    marker,
                    `<strong class="emoji">${marker}</strong>`
                );
            }
        });
        
        // Convert line breaks to HTML
        formattedMessage = formattedMessage.replace(/\n/g, '<br>');
        
        messageElement.innerHTML = formattedMessage;
        
        const timeElement = document.createElement('span');
        timeElement.className = 'message-time';
        timeElement.textContent = getCurrentTime();
        messageElement.appendChild(timeElement);
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Add typing indicator
    function addTypingIndicator() {
        const typingElement = document.createElement('div');
        typingElement.className = 'message ai-message typing-indicator';
        typingElement.innerHTML = '<span>Dr. Arogya is typing</span><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>';
        chatMessages.appendChild(typingElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return typingElement;
    }

    // Remove typing indicator
    function removeTypingIndicator(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        } else {
            const typingIndicators = document.querySelectorAll('.typing-indicator');
            typingIndicators.forEach(indicator => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            });
        }
    }

    // Get current time in HH:MM format
    function getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Translate interface based on selected language
    function translateInterface(language) {
        // In a real app, this would use the Gemini API for translation
        // For demo purposes, we'll use hardcoded translations for key elements
        
        const translations = {
            english: {
                greeting: "Hi, I'm Dr. Arogya, your health companion. Tell me what's bothering you today?",
                placeholder: "Describe your symptoms or health concerns...",
                reportTitle: "Health Report",
                downloadBtn: "Download PDF",
                placeholderText: "Your health report will appear here after consultation."
            },
            hindi: {
                greeting: "नमस्ते, मैं डॉ. आरोग्य हूँ, आपका स्वास्थ्य साथी। आज आपको क्या परेशानी है?",
                placeholder: "अपने लक्षणों या स्वास्थ्य चिंताओं का वर्णन करें...",
                reportTitle: "स्वास्थ्य रिपोर्ट",
                downloadBtn: "पीडीएफ डाउनलोड करें",
                placeholderText: "परामर्श के बाद आपकी स्वास्थ्य रिपोर्ट यहां दिखाई देगी।"
            },
            marathi: {
                greeting: "नमस्कार, मी डॉ. आरोग्य आहे, तुमचा आरोग्य साथीदार. आज तुम्हाला काय त्रास होत आहे?",
                placeholder: "तुमच्या लक्षणांचे किंवा आरोग्य चिंतांचे वर्णन करा...",
                reportTitle: "आरोग्य अहवाल",
                downloadBtn: "पीडीएफ डाउनलोड करा",
                placeholderText: "सल्ल्यानंतर तुमचा आरोग्य अहवाल येथे दिसेल."
            },
            kannada: {
                greeting: "ನಮಸ್ಕಾರ, ನಾನು ಡಾ. ಆರೋಗ್ಯ, ನಿಮ್ಮ ಆರೋಗ್ಯ ಸಂಗಾತಿ. ಇಂದು ನಿಮ್ಮನ್ನು ಏನು ಕಾಡುತ್ತಿದೆ?",
                placeholder: "ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳು ಅಥವಾ ಆರೋಗ್ಯ ಕಾಳಜಿಗಳನ್ನು ವಿವರಿಸಿ...",
                reportTitle: "ಆರೋಗ್ಯ ವರದಿ",
                downloadBtn: "PDF ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ",
                placeholderText: "ಸಮಾಲೋಚನೆಯ ನಂತರ ನಿಮ್ಮ ಆರೋಗ್ಯ ವರದಿ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ."
            }
        };
        
        // Update interface elements with translations
        if (translations[language]) {
            // Update placeholder
            userMessageInput.placeholder = translations[language].placeholder;
            
            // Update report title
            document.querySelector('.report-header h2').textContent = translations[language].reportTitle;
            
            // Update download button
            document.querySelector('.download-btn').innerHTML = `<i class="fas fa-download"></i> ${translations[language].downloadBtn}`;
            
            // Update placeholder text
            const placeholderElement = document.querySelector('.placeholder-text');
            if (placeholderElement) {
                placeholderElement.textContent = translations[language].placeholderText;
            }
            
            // If this is the first language change, update the greeting
            if (state.conversation.length <= 2) {
                // Clear chat
                chatMessages.innerHTML = '';
                // Add translated greeting
                addAIMessage(translations[language].greeting);
                // Reset conversation
                state.conversation = [
                    { role: 'assistant', content: translations[language].greeting }
                ];
            }
        }
    }

    // Initialize the application
    initChat();
});

// Add CSS for typing indicator
const style = document.createElement('style');
style.textContent = `
.typing-indicator {
    display: flex;
    align-items: center;
}

.typing-indicator span {
    display: inline-block;
}

.typing-indicator .dot {
    animation: typingDot 1.4s infinite;
    opacity: 0.7;
}

.typing-indicator .dot:nth-child(2) {
    animation-delay: 0.2s;
}

.typing-indicator .dot:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typingDot {
    0% { opacity: 0.7; }
    50% { opacity: 0.3; }
    100% { opacity: 0.7; }
}
`;
document.head.appendChild(style);