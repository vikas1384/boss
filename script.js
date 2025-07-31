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
        emergencyDetected: false
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
        addAIMessage("Hi, I'm Dr. Arogya, your health companion. Tell me what's bothering you today?");
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

IMPORTANT: Do not use asterisk (*) symbols in your responses. Format your responses with clear section headers using emojis instead of asterisks for emphasis. Follow this template for complete assessments:

🧾 Symptom Summary
[Summarize the symptoms reported by the user]

🧠 Possible Non-Diagnostic Explanation
[Provide possible explanations without making a diagnosis]

🧘 Lifestyle Guidance
[Offer lifestyle recommendations]

🌿 दादी माँ का नुस्खा
[Suggest traditional home remedies if appropriate]

📅 When to See a Doctor
[Advise when professional medical help should be sought]

🔒 Safety Disclaimer
[Include a safety disclaimer]`
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

        // Check if this is a complete assessment response
        if (response.includes('🧾 Symptom Summary') || 
            response.includes('🧠 Possible Non-Diagnostic Explanation')) {
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

    // Update the report content with the assessment
    function updateReportContent(response) {
        // Clear placeholder text
        reportContent.innerHTML = '';

        // Remove any asterisk symbols from the response
        response = response.replace(/\*/g, '');

        // Create report header
        const reportHeader = document.createElement('div');
        reportHeader.className = 'report-section';
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

        // Parse and format the assessment sections
        const sections = [
            { marker: '🧾 Symptom Summary', title: 'Symptom Summary' },
            { marker: '🧠 Possible Non-Diagnostic Explanation', title: 'Possible Explanation' },
            { marker: '🧘 Lifestyle Guidance', title: 'Lifestyle Guidance' },
            { marker: '🌿 दादी माँ का नुस्खा', title: 'Traditional Remedy' },
            { marker: '📅 When to See a Doctor', title: 'When to See a Doctor' }
        ];

        sections.forEach(section => {
            if (response.includes(section.marker)) {
                const startIndex = response.indexOf(section.marker);
                let endIndex = response.length;
                
                // Find the end of this section (start of next section)
                for (const nextSection of sections) {
                    if (nextSection.marker !== section.marker) {
                        const nextSectionIndex = response.indexOf(nextSection.marker, startIndex + section.marker.length);
                        if (nextSectionIndex > startIndex && nextSectionIndex < endIndex) {
                            endIndex = nextSectionIndex;
                        }
                    }
                }

                // Extract and format the section content
                let sectionContent = response.substring(startIndex, endIndex).trim();
                sectionContent = sectionContent.replace(section.marker, '');
                
                // Remove any remaining asterisks from section content
                sectionContent = sectionContent.replace(/\*/g, '');

                const sectionElement = document.createElement('div');
                sectionElement.className = 'report-section';
                
                // Apply special styling for traditional remedy
                if (section.marker === '🌿 दादी माँ का नुस्खा') {
                    sectionElement.innerHTML = `
                        <h3>${section.title}</h3>
                        <div class="traditional-remedy">${sectionContent}</div>
                    `;
                } else {
                    sectionElement.innerHTML = `
                        <h3>${section.title}</h3>
                        <p>${sectionContent}</p>
                    `;
                }
                
                reportContent.appendChild(sectionElement);
            }
        });

        // Add emergency indicator if detected
        if (state.emergencyDetected) {
            const emergencyElement = document.createElement('div');
            emergencyElement.className = 'emergency-indicator';
            emergencyElement.innerHTML = `
                <p>⚠️ EMERGENCY WARNING: This may require immediate medical attention. Please contact emergency services or visit the nearest hospital immediately.</p>
            `;
            reportContent.appendChild(emergencyElement);
        }

        // Add disclaimer
        const disclaimerElement = document.createElement('div');
        disclaimerElement.className = 'disclaimer';
        disclaimerElement.innerHTML = `
            <p>🔒 <strong>Safety Disclaimer:</strong> This is not a replacement for a licensed medical opinion. Always consult a real doctor for serious or persistent conditions.</p>
        `;
        reportContent.appendChild(disclaimerElement);

        // Mark report as generated
        state.reportGenerated = true;
    }

    // Generate PDF from the report content
    function generatePDF() {
        if (!state.assessmentComplete) {
            alert('Please complete a consultation first to generate a report.');
            return;
        }
        
        // If we have assessment but missing user info, prompt for it
        if (!state.userName || !state.userAge || !state.userGender) {
            let missingInfo = [];
            if (!state.userName) missingInfo.push("name");
            if (!state.userAge) missingInfo.push("age");
            if (!state.userGender) missingInfo.push("gender/sex");
            
            alert(`Please provide your ${missingInfo.join(", ")} to complete the health report.`);
            return;
        }
        
        // If report not yet generated but we have all info, generate it now
        if (!state.reportGenerated) {
            // Find the assessment response in the conversation history
            let foundAssessment = false;
            for (let i = state.conversation.length - 1; i >= 0; i--) {
                const entry = state.conversation[i];
                if (entry.role === 'assistant' && 
                    (entry.content.includes('🧾 Symptom Summary') || 
                     entry.content.includes('🧠 Possible Non-Diagnostic Explanation'))) {
                    // Remove any asterisks from the content before updating the report
                    const cleanContent = entry.content.replace(/\*/g, '');
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
            // Ensure jsPDF is properly loaded
            if (!window.jspdf || !window.jspdf.jsPDF) {
                console.error('jsPDF library not properly loaded');
                alert('PDF generation library not loaded properly. Please refresh the page and try again.');
                return;
            }
            
            // Ensure html2canvas is properly loaded
            if (!window.html2canvas) {
                console.error('html2canvas library not properly loaded');
                alert('PDF generation library (html2canvas) not loaded properly. Please refresh the page and try again.');
                return;
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Show loading message
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'loading-message';
            loadingMessage.textContent = 'Generating PDF...';
            document.body.appendChild(loadingMessage);
            
            // Make sure report content is visible
            reportContent.style.display = 'block';
            
            // Use html2canvas with better error handling
            window.html2canvas(reportContent, {
                scale: 2, // Higher quality
                useCORS: true, // Allow cross-origin images
                logging: true, // Enable logging for debugging
                onclone: (clonedDoc) => {
                    // Make sure all elements are visible in the clone
                    const clonedContent = clonedDoc.getElementById('report-content');
                    if (clonedContent) {
                        clonedContent.style.display = 'block';
                        clonedContent.style.width = reportContent.offsetWidth + 'px';
                        clonedContent.style.height = 'auto';
                    }
                }
            }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 190;
                const pageHeight = 290;
                const imgHeight = canvas.height * imgWidth / canvas.width;
                let heightLeft = imgHeight;
                let position = 10;

                // Add title to the PDF
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text('Arogya AI Health Report', 105, 15, { align: 'center' });
                
                // Add the report image
                doc.addImage(imgData, 'PNG', 10, 25, imgWidth, imgHeight);
                heightLeft -= (pageHeight - 25);

                // Add new pages if the content is too long
                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    doc.addPage();
                    doc.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }

                // Add footer to all pages
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`Generated by Arogya AI on ${new Date().toLocaleDateString()} - Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
                }

                // Remove loading message
                document.body.removeChild(loadingMessage);
                
                // Save the PDF with patient name if available
                const fileName = state.userName ? 
                    `Arogya_Health_Report_${state.userName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf` : 
                    `Arogya_Health_Report_${new Date().toISOString().split('T')[0]}.pdf`;
                    
                doc.save(fileName);
                console.log('PDF generated successfully');
            }).catch(error => {
                console.error('Error generating PDF with html2canvas:', error);
                document.body.removeChild(loadingMessage);
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
        Please engage in the symptom understanding phase as described in your instructions. 
        Ask relevant follow-up questions about duration, severity, frequency, and other contextual factors. 
        ${needsUserInfo ? 'It is important to ask for the user\'s name, age, and gender/sex if not already provided, as this information is essential for the health report.' : ''}
        If you have enough information, provide a complete recommendation following the template in your instructions with symptom summary, possible explanation, lifestyle guidance, traditional remedy, and when to see a doctor.
        
        Remember to NEVER use asterisk (*) symbols in your responses. Use the emoji section headers as specified in your instructions.`;
    }

    // Prepare prompt for follow-up questions
    function prepareFollowUpPrompt(message) {
        return `The user has responded with: "${message}". 
        Continue the conversation based on this response. 
        If they're asking for clarification or have new symptoms, provide appropriate guidance. 
        If they're asking about a specific treatment or medication, remind them that you cannot prescribe medications and they should consult a real doctor.
        
        Remember to NEVER use asterisk (*) symbols in your responses. If you have enough information to provide a complete assessment, use the emoji section headers as specified in your instructions.`;
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