# Building and Running ZenList Web

## Phone-Sized Web UI
The ZenList web app is configured to display as a borderless phone-sized interface, making it look like users have the native mobile app even when accessed from a browser.

### Features:
- **Fixed Dimensions**: 390px × 844px (standard mobile viewport)
- **Responsive**: Adapts to small screens by going full-screen
- **Styled Shadow**: Subtle drop shadow on desktop/tablet screens
- **Seamless Experience**: Same UI/UX as native app

## Running Locally

### Start Development Server
```bash
cd frontend
npm start
# Then press 'w' to open web version
```

Or directly:
```bash
cd frontend
expo start --web
```

### Build for Production
```bash
cd frontend
expo export --platform web
```

### Output
Built files will be in `dist/` directory - ready to deploy to any static hosting.

## Deployment
The `dist/web/` folder contains the complete web app. You can:
- Upload to Vercel, Netlify, or AWS S3
- Serve from your own web server
- Configure CORS headers to point to your backend API

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design adapts to small phone screens and large monitors
