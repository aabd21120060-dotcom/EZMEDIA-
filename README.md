{
  "name": "ezmedia",
  "version": "11.0.0",
  "private": true,
  "description": "AZ MEDIA 11.0 - Smart Media Platform",
  "type": "module",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "check": "node --check src/server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^17.2.2",
    "express": "^5.1.0",
    "helmet": "^8.1.0",
    "pg": "^8.16.3"
  }
}
