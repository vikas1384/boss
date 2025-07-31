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
    pendingPdfGeneration: false
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
        if (window.jspdf && window.jspdf.jsPDF) {
            console.log('jsPDF library loaded successfully');
        } else {
            console.error('jsPDF library not loaded properly');
            // Try to reload the library
            loadPdfLibraries();
        }
        
        if (window.html2canvas) {
            console.log('html2canvas library loaded successfully');
        } else {
            console.error('html2canvas library not loaded properly');
            // Try to reload the library
            loadPdfLibraries();
        }
        
        // Check if both libraries are loaded properly
        if (!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas) {
            console.log('PDF libraries not fully loaded during initialization, attempting to load them now...');
            loadPdfLibraries();
        } else {
            console.log('All PDF libraries successfully verified during initialization');
        }
        
        addAIMessage("Hi, I'm Dr. Arogya, your health companion. Tell me what's bothering you today?");
    }
    
    // Function to load PDF libraries if they're not loaded properly
function loadPdfLibraries() {
    console.log('Attempting to load PDF libraries...');
    
    // Load jsPDF
    if (!window.jspdf || !window.jspdf.jsPDF) {
        const jspdfScript = document.createElement('script');
        jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        jspdfScript.async = true;
        jspdfScript.onload = () => {
            console.log('jsPDF library loaded dynamically');
            // Check if both libraries are loaded and retry PDF generation if needed
            if (window.html2canvas && window.jspdf && window.jspdf.jsPDF && state.pendingPdfGeneration) {
                console.log('Both libraries loaded, retrying PDF generation...');
                state.pendingPdfGeneration = false;
                generatePDF();
            }
        };
        jspdfScript.onerror = () => console.error('Failed to load jsPDF library dynamically');
        document.head.appendChild(jspdfScript);
    }
    
    // Load html2canvas
    if (!window.html2canvas) {
        const html2canvasScript = document.createElement('script');
        html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        html2canvasScript.async = true;
        html2canvasScript.onload = () => {
            console.log('html2canvas library loaded dynamically');
            // Check if both libraries are loaded and retry PDF generation if needed
            if (window.html2canvas && window.jspdf && window.jspdf.jsPDF && state.pendingPdfGeneration) {
                console.log('Both libraries loaded, retrying PDF generation...');
                state.pendingPdfGeneration = false;
                generatePDF();
            }
        };
        html2canvasScript.onerror = () => console.error('Failed to load html2canvas library dynamically');
        document.head.appendChild(html2canvasScript);
    }
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

    downloadPdfButton.addEventListener('click', generatePDF);
    closeModalButton.addEventListener('click', () => emergencyModal.style.display = 'none');
    closeAlertButton.addEventListener('click', () => emergencyModal.style.display = 'none');
    callEmergencyButton.addEventListener('click', callEmergencyServices);

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

        // Check if we were waiting for user info and now have it
        if (state.assessmentComplete && !state.reportGenerated) {
            if (state.userName && state.userAge && state.userGender) {
                // Find the assessment response in the conversation history
                for (let i = state.conversation.length - 1; i >= 0; i--) {
                    const entry = state.conversation[i];
                    if (entry.role === 'assistant' && 
                        (entry.content.includes('🧾 Symptom Summary') || 
                         entry.content.includes('🧠 Possible Non-Diagnostic Explanation'))) {
                        updateReportContent(entry.content);
                        break;
                    }
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
            
            // If we don't have user information yet, ask for it before generating the report
            if (!state.userName || !state.userAge || !state.userGender) {
                promptForUserInfo();
            } else {
                updateReportContent(response);
            }
        }

        // Display the message in the chat
        addAIMessage(response);

        // Scroll to the bottom of the chat
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Prompt user for missing information
    function promptForUserInfo() {
        let missingInfo = [];
        
        if (!state.userName) missingInfo.push("name");
        if (!state.userAge) missingInfo.push("age");
        if (!state.userGender) missingInfo.push("gender/sex");
        
        if (missingInfo.length > 0) {
            const infoNeeded = missingInfo.join(", ");
            const promptMessage = `To generate your health report, I need a few more details. Could you please provide your ${infoNeeded}?`;
            
            // Add this as an AI message
            addAIMessage(promptMessage);
            state.conversation.push({ role: 'assistant', content: promptMessage });
        }
    }

    // Update the report content with the assessment - Doctor-friendly version
    function updateReportContent(response) {
        // Clear placeholder text
        reportContent.innerHTML = '';

        // Remove any asterisk symbols from the response
        response = response.replace(/\*/g, '');

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

    // Generate PDF from the report content - Doctor-friendly version
    function generatePDF() {
        console.log('Starting PDF generation process...');
        
        if (!state.assessmentComplete) {
            alert('Please complete a consultation first to generate a report.');
            console.log('PDF generation aborted: No assessment completed');
            return;
        }
        
        // If we have assessment but missing user info, prompt for it
        if (!state.userName || !state.userAge || !state.userGender) {
            let missingInfo = [];
            if (!state.userName) missingInfo.push("name");
            if (!state.userAge) missingInfo.push("age");
            if (!state.userGender) missingInfo.push("gender/sex");
            
            alert(`Please provide your ${missingInfo.join(", ")} to complete the health report.`);
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
            console.log('Checking PDF libraries before generation...');
            // Check if libraries are loaded, if not, try to load them
            if (!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas) {
                console.error('PDF libraries not properly loaded, attempting to load them now...');
                state.pendingPdfGeneration = true;
                loadPdfLibraries();
                
                // Show a message to the user
                alert('PDF generation libraries are being loaded. The download will start automatically once ready.');
                return;
            }
            
            console.log('PDF libraries verified, proceeding with PDF generation...');
            const { jsPDF } = window.jspdf;
            // Create PDF in portrait mode with A4 dimensions (210 x 297 mm)
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            // Show loading message
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'loading-message';
            loadingMessage.textContent = 'Generating PDF...';
            document.body.appendChild(loadingMessage);
            
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
                const imgHeight = canvas.height * imgWidth / canvas.width;
                
                // Add the report image to the first page
                doc.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
                
                // If content exceeds page height, add new pages
                let heightLeft = imgHeight;
                let position = margin;
                
                heightLeft -= (pageHeight - margin * 2);
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    doc.addPage();
                    doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
                    heightLeft -= (pageHeight - margin * 2);
                }
                
                // Add professional footer to all pages
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    
                    // Add page number
                    doc.setFontSize(8);
                    doc.setTextColor(100, 100, 100);
                    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
                    
                    // Add disclaimer footer
                    doc.setFontSize(6);
                    doc.setTextColor(150, 150, 150);
                    doc.text('This is an AI-generated report and not a substitute for professional medical advice. Please consult a healthcare provider.', 
                             pageWidth / 2, pageHeight - 10, { align: 'center', maxWidth: pageWidth - 20 });
                    
                    // Add generation date
                    doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 
                             margin, pageHeight - 5);
                }
                
                // Remove temporary elements
                document.body.removeChild(reportClone);
                document.body.removeChild(loadingMessage);
                
                // Save the PDF with a professional filename
                const formattedDate = new Date().toISOString().split('T')[0];
                const fileName = state.userName ? 
                    `Medical_Report_${state.userName.replace(/\s+/g, '_')}_${formattedDate}.pdf` : 
                    `Medical_Report_${formattedDate}.pdf`;
                    
                doc.save(fileName);
                console.log('Professional medical PDF report generated and saved successfully');
                
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
                alert('There was an error generating the PDF. Please try again.');
            });
        } catch (error) {
            console.error('Error in PDF generation process:', error);
            alert('There was an error generating the PDF. Please check console for details.');
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
        // Simple name extraction (very basic)
        if (!state.userName) {
            const nameMatch = message.match(/my name is ([A-Za-z\s]+)/i) || 
                            message.match(/name[:\s]+([A-Za-z\s]+)/i) || 
                            message.match(/I am ([A-Za-z\s]+)/i) || 
                            message.match(/I'm ([A-Za-z\s]+)/i);
            if (nameMatch && nameMatch[1]) {
                state.userName = nameMatch[1].trim();
            }
        }

        // Simple age extraction
        if (!state.userAge) {
            const ageMatch = message.match(/I am (\d+) years old|I'm (\d+) years old|I'm (\d+)|I am (\d+)|age[:\s]+(\d+)|age[:\s]+is (\d+)|age (\d+)/i);
            if (ageMatch) {
                const age = ageMatch[1] || ageMatch[2] || ageMatch[3] || ageMatch[4] || ageMatch[5] || ageMatch[6] || ageMatch[7];
                if (age) state.userAge = age;
            }
        }

        // Simple gender extraction
        if (!state.userGender) {
            const lowerMessage = message.toLowerCase();
            if (lowerMessage.includes(' male ') || lowerMessage.includes('i am male') || 
                lowerMessage.includes("i'm male") || lowerMessage.includes("gender male") || 
                lowerMessage.includes("gender: male") || lowerMessage.includes("sex male") || 
                lowerMessage.includes("sex: male")) {
                state.userGender = 'Male';
            } else if (lowerMessage.includes(' female ') || lowerMessage.includes('i am female') || 
                       lowerMessage.includes("i'm female") || lowerMessage.includes("gender female") || 
                       lowerMessage.includes("gender: female") || lowerMessage.includes("sex female") || 
                       lowerMessage.includes("sex: female")) {
                state.userGender = 'Female';
            }
        }

        // Simple location extraction
        if (!state.userLocation) {
            const locationMatch = message.match(/I am from ([A-Za-z\s,]+)|I'm from ([A-Za-z\s,]+)|in ([A-Za-z\s,]+)|location[:\s]+([A-Za-z\s,]+)/i);
            if (locationMatch) {
                const location = locationMatch[1] || locationMatch[2] || locationMatch[3] || locationMatch[4];
                if (location) state.userLocation = location.trim();
            }
        }
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