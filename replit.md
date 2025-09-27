# Website Safety Scanner

## Overview

Website Safety Scanner is a fully functional Chrome browser extension that provides real-time security analysis for websites. The extension analyzes web pages as users browse and provides safety scores (0-100), threat detection, and security recommendations through an intuitive popup interface. It performs comprehensive website safety checks using multiple security factors and maintains local storage for caching results and improving performance.

## Current Status

✅ **COMPLETED** - Chrome extension is fully functional with all core features implemented:
- Real-time website safety scoring (0-100 scale)  
- Visual safety indicators (green/yellow/red)
- Threat detection for malware, phishing, and suspicious activity
- Professional popup interface with detailed security analysis
- Caching system for improved performance
- Development server for testing and installation

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The extension uses a multi-component Chrome extension architecture:
- **Popup Interface**: HTML/CSS/JavaScript-based popup (`popup.html`, `popup.css`, `popup.js`) that displays safety scores, threat analysis, and website information in a clean, user-friendly interface
- **Content Script**: Injected into all web pages (`content.js`) to analyze page content, detect SSL usage, and communicate page information to the background service
- **Background Service Worker**: Persistent background script (`background.js`) that handles inter-component messaging, performs safety checks, and manages data storage

### Extension Communication Pattern
The extension uses Chrome's message passing API for communication between components:
- Content scripts send page load events and security data to the background service
- The popup communicates with the background service to request safety analysis
- Background service coordinates between content scripts and popup, managing state and API calls

### Data Storage Strategy
Local browser storage is used for:
- Caching safety check results to reduce API calls and improve performance
- Storing page analysis data temporarily for quick access
- Managing extension state across browser sessions

### Development Server
An Express.js development server (`server.js`) serves extension files during development:
- Provides static file serving for extension components
- Includes CORS headers for cross-origin requests
- Offers development endpoints for testing extension functionality

### Security Analysis Engine
The extension implements multi-layered security analysis:
- SSL/HTTPS detection for secure connection verification
- Content analysis for suspicious elements and links
- Integration with external threat detection APIs
- Real-time safety scoring based on multiple security factors

## External Dependencies

### Chrome Extension APIs
- **chrome.runtime**: Inter-component messaging and extension lifecycle management
- **chrome.tabs**: Tab information access and navigation event monitoring
- **chrome.storage**: Local data persistence and caching
- **chrome.scripting**: Content script injection and management

### Security APIs
- **VirusTotal API**: External threat intelligence and website reputation checking (based on host permissions in manifest)
- Domain safety verification and malware detection services

### Node.js Dependencies
- **Express.js**: Development server framework for serving extension files and providing API endpoints during development
- Standard Node.js modules for file handling and URL processing

### Browser Permissions
- **activeTab**: Access to currently active browser tab information
- **storage**: Local browser storage for caching and data persistence
- **scripting**: Content script injection capabilities
- **host_permissions**: Broad web access for security analysis across all websites