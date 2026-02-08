
# Kautions-Safe (Berlin Tenant Pro)

A professional apartment handover inspection app for Germany, designed to document apartment conditions during move-in and move-out inspections.

## Features

### Core Functionality
- **Bilingual Workflow**: English UI with German PDF exports for landlord acceptance
- **Room-by-Room Inspection**: Add rooms (Wohnzimmer, Bad, Küche, etc.) with condition tracking
- **Defect Documentation**: 
  - Toggle between "OK" and "Defect" status
  - Required photo and description for defects
- **Meter Scanning**: Document utility meters (electricity, gas, water, heating) with readings
- **Digital Signatures**: Capture landlord and tenant signatures
- **PDF Export**: Generate professional German "Wohnungsübergabeprotokoll" with legal disclaimer

### Monetization
- **Free Inspection**: Create and document inspections at no cost
- **Pay-per-Report**: €8.99 to unlock signed PDF export (via Superwall/RevenueCat)

## Tech Stack

### Frontend
- **React Native + Expo 54**: Cross-platform mobile app
- **expo-image-picker**: Camera and photo library access for defect documentation
- **expo-superwall**: In-app purchase paywall integration
- **react-native-signature-canvas**: Digital signature capture

### Backend
- **Database Tables**:
  - `inspections`: Property details, participants, signatures, status
  - `rooms`: Room-by-room condition with defect photos/descriptions
  - `meters`: Utility meter readings with photos
- **API Endpoints**:
  - CRUD operations for inspections, rooms, and meters
  - Image upload to object storage
  - PDF generation in German with legal disclaimer

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator or Android Emulator (or physical device)

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Configuration

1. **Image Picker Permissions**: Already configured in `app.json`
   - Camera permission for defect photos
   - Photo library permission for selecting images

2. **Superwall Setup**: 
   - Add your Superwall API key to the app
   - Configure the €8.99 PDF export paywall

3. **Backend Integration**:
   - The backend is being built automatically
   - API endpoints will be available at the configured backend URL

## App Structure

```
app/
├── (tabs)/
│   └── (home)/
│       └── index.tsx          # Home screen with inspection list
├── new-inspection.tsx         # Create new inspection form
├── inspection/
│   └── [id].tsx              # Inspection detail with rooms/meters
└── +not-found.tsx            # 404 page

styles/
└── commonStyles.ts           # Color theme and shared styles

components/
├── IconSymbol.tsx            # Cross-platform icons
└── FloatingTabBar.tsx        # Custom tab bar (not used in v1)
```

## Color Theme

Professional German apartment inspection theme:
- **Primary**: #2563EB (Professional blue)
- **Success**: #10B981 (Green for "OK" status)
- **Warning**: #F59E0B (Amber for "Defect" status)
- **Error**: #EF4444 (Red for critical issues)

## Backend API

### Inspections
- `POST /api/inspections` - Create new inspection
- `GET /api/inspections` - List all user inspections
- `GET /api/inspections/:id` - Get inspection details
- `PUT /api/inspections/:id` - Update inspection
- `DELETE /api/inspections/:id` - Delete inspection

### Rooms
- `POST /api/inspections/:inspectionId/rooms` - Add room
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room

### Meters
- `POST /api/inspections/:inspectionId/meters` - Add meter
- `PUT /api/meters/:id` - Update meter
- `DELETE /api/meters/:id` - Delete meter

### Media & Export
- `POST /api/upload/image` - Upload defect photos, meter photos, signatures
- `POST /api/inspections/:id/generate-pdf` - Generate German PDF report

## PDF Export Format

The generated PDF includes:
- **Title**: "Wohnungsübergabeprotokoll"
- **Property Details**: Address, inspection type, date
- **Participants**: Landlord and tenant names
- **Legal Disclaimer**: "Dieses Protokoll dient der Dokumentation des Zustands bei Wohnungsübergabe und ist verbindlich für beide Parteien."
- **Room Inspection**: Room-by-room results with defect photos
- **Meter Readings**: Table of all utility meters
- **Signatures**: Digital signatures from both parties

## Development Notes

### First Version - Minimal Implementation
- Single home screen with inspection list
- No complex tab navigation
- Focus on core inspection workflow
- Simple, clean UI

### Future Enhancements
- Offline mode with local storage
- Template rooms for common apartment layouts
- Multi-language support (English, German, Turkish)
- Export to email/cloud storage
- Inspection history and analytics

## License

Proprietary - All rights reserved

## Support

For issues or questions, please contact support.
