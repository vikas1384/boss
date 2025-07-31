# Arogya AI - Professional Health Assessment Tool

![Arogya AI](https://img.shields.io/badge/Arogya-AI-4285f4)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

Arogya AI is a compassionate, culturally-aware AI medical assistant designed for Indian users. It guides users through structured, human-friendly conversations to understand symptoms, give preliminary suggestions, and generate a professional, doctor-friendly medical report in PDF format.

## 🌟 Features

- **Accessible Health Information**: Provides reliable health information in a conversational format accessible to users with varying levels of health literacy.

- **Multilingual Support**: Offers support in multiple Indian languages (English, Hindi, Marathi, Kannada) to reach a broader audience.

- **Traditional Remedies Integration**: Incorporates traditional home remedies ("Dadi Maa ke Nuskhe") alongside modern health guidance.

- **Symptom Assessment**: Helps users understand their symptoms and provides appropriate guidance while clearly communicating limitations.

- **Professional PDF Report Generation**: Creates downloadable doctor-friendly medical reports with professional formatting, structured sections, and clinical terminology suitable for healthcare professionals.

- **Emergency Detection**: Identifies potential emergency situations and provides appropriate alerts with clear guidance.

- **Clinical Assessment Format**: Organizes health information in a structured format familiar to healthcare providers, including symptom summary, clinical assessment, and medical recommendations.

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- Node.js (v16 or higher) for production deployment

### Local Development

1. Clone this repository or download the ZIP file
2. Extract the files to your preferred location
3. Create a `.env` file in the root directory with your API keys (see `.env.example`)
4. Install dependencies: `npm install`
5. Start the development server: `npm run dev`
6. Open your browser and navigate to `http://localhost:8000`

### Production Deployment

#### Netlify Deployment

1. Fork or clone this repository to your GitHub account
2. Sign up for a [Netlify](https://www.netlify.com/) account
3. Create a new site from Git and select your repository
4. Configure environment variables in Netlify dashboard (add your API keys)
5. Deploy with the following settings:
   - Build command: `npm install`
   - Publish directory: `.`

#### Render Deployment

1. Fork or clone this repository to your GitHub account
2. Sign up for a [Render](https://render.com/) account
3. Create a new Web Service and connect to your GitHub repository
4. Configure the Web Service with these settings:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables in Render dashboard:
   - GROQ_API_KEY: Your GROQ API key
   - NODE_ENV: `production`
6. Click "Create Web Service" to deploy the application

## 💻 Usage

1. Type your health concern or symptoms in the chat box
2. Dr. Arogya will ask follow-up questions to better understand your condition
3. After gathering sufficient information, Dr. Arogya will provide:
   - A comprehensive symptom summary
   - Clinical assessment with possible explanations
   - Professional medical recommendations
   - Supportive care measures
   - Traditional remedies when applicable
   - Clear guidance on when to seek professional medical attention
4. A professional medical report will be generated that you can download as a PDF, formatted for healthcare professionals with:
   - Patient information section
   - Structured clinical assessment
   - Professional medical terminology
   - Clear sections with visual hierarchy
   - Medical disclaimer and AI-generated watermark

## 🌐 Language Support

Arogya AI currently supports the following languages:

- English
- Hindi (हिंदी)
- Marathi (मराठी)
- Kannada (ಕನ್ನಡ)

Select your preferred language from the dropdown menu in the chat interface.

## ⚠️ Important Disclaimer

Arogya AI is not a replacement for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read or heard from Arogya AI.

## 🔒 Privacy

Arogya AI prioritizes user privacy. While the application uses AI APIs to process conversations, we implement best practices to protect user data:

- No personal health information is permanently stored
- Conversations are not saved after the session ends
- PDF reports are generated locally on your device

## 🛠️ Technologies Used

- HTML5, CSS3, JavaScript
- Node.js and Express for server-side functionality
- Environment variables for secure API key management
- GROQ API (llama3-70b-8192 model) for AI-powered health assessment
- jsPDF for professional PDF report generation
- html2canvas for high-quality report capture
- Render for cloud deployment

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- World Health Organization (WHO)
- Centers for Disease Control and Prevention (CDC)
- Indian Council of Medical Research (ICMR)
- Ministry of Health and Family Welfare (MoHFW), Government of India

---

Developed with ❤️ for better health accessibility in India