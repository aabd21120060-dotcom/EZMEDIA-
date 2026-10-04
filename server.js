"use strict";

/*
============================================================
 EZ MEDIA 11.0
 INTELLIGENT MEDIA PLATFORM
============================================================

 الملف الرئيسي:
 server.js

 المنصة:
 EZ MEDIA

 الإصدار:
 11.0.0

 الوظائف الرئيسية:
 - Express API
 - PostgreSQL
 - CMS
 - Media
 - Live
 - Breaking News
 - Storage
 - Upload
 - Commercial
 - Notifications
 - AI
 - AI Agents
 - AI Collaboration
 - Media Memory
 - Event Intelligence
 - Autonomous Media Operations
 - Executive Command Center
 - Human Approval
 - Emergency Stop
 - Health Monitoring
 - System Monitoring

 مبدأ مهم:
 لا يتم الادعاء بأن بثًا خارجيًا أو نشرًا خارجيًا
 تم تنفيذه فعليًا ما لم يكن التكامل الخارجي متصلًا.
============================================================
*/


/* =========================================================
   CORE IMPORTS
========================================================= */

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");


/* =========================================================
   DATABASE
========================================================= */

const {
  health: databaseHealth
} = require("./src/database/db");

const {
  initializeDatabase
} = require("./src/database/init");

const {
  initializeMediaDatabase
} = require("./src/database/media-init");

const {
  initializeNotifications
} = require("./src/database/notification-bootstrap");


/* =========================================================
   NOTIFICATION WORKER
========================================================= */

const {
  startNotificationWorker,
  registerNotificationWorkerShutdown
} = require("./src/services/notificationWorker");


/* =========================================================
   CORE ROUTES
========================================================= */

const contentRoutes =
  require("./src/routes/content");

const aiRoutes =
  require("./src/routes/ai");

const mediaRoutes =
  require("./src/routes/media");

const liveRoutes =
  require("./src/routes/live");

const breakingRoutes =
  require("./src/routes/breaking");

const storageRoutes =
  require("./src/routes/storage");

const uploadRoutes =
  require("./src/routes/upload");

const commercialRoutes =
  require("./src/routes/commercial");

const notificationsRoutes =
  require("./src/routes/notifications");

const notificationWorkerRoutes =
  require("./src/routes/notification-worker");


/* =========================================================
   SAFE REQUIRE
========================================================= */

function safeRequire(modulePath) {

  try {

    return require(modulePath);

  } catch (error) {

    console.warn(
      `EZ MEDIA: optional module unavailable: ${modulePath}`
    );

    console.warn(
      `EZ
