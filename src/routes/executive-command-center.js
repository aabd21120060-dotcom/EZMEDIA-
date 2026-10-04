'use strict';

/**
 * EZ MEDIA 11.0
 * CODE 119
 * Executive Command Center API
 *
 * يربط لوحة القيادة التنفيذية مع:
 * - AI
 * - العمليات
 * - الأخبار
 * - المحتوى
 * - البث
 * - الجدولة
 * - الإعلانات
 * - CRM
 * - الذاكرة
 * - RAG
 */

const express = require('express');

function createExecutiveCommandCenterRouter(options = {}) {
  const router = express.Router();

  const integration = options.integration;
  const adminGuard = options.adminGuard;

  if (!integration) {
    router.use((req, res) => {
      res.status(503).json({
        success: false,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        status: 'unavailable',
        message: 'Executive Command Center integration is not initialized',
        timestamp: new Date().toISOString()
      });
    });

    return router;
  }

  /*
   * حماية اختيارية.
   *
   * لا يتم تفعيلها افتراضيًا حتى تعمل اللوحة
   * أثناء مرحلة التطوير والاختبار.
   */
  function protect(req, res, next) {
    if (typeof adminGuard !== 'function') {
      return next();
    }

    return adminGuard(req, res, next);
  }

  /*
   * GET /status
   */
  router.get('/status', async (req, res) => {
    try {
      const result = integration.status();

      res.json({
        success: true,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /*
   * GET /health
   */
  router.get('/health', async (req, res) => {
    try {
      const result = await integration.health();

      const statusCode =
        result.status === 'degraded'
          ? 503
          : 200;

      res.status(statusCode).json({
        success: statusCode === 200,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /*
   * GET /dashboard
   *
   * المصدر الرئيسي للواجهة.
   */
  router.get('/dashboard', async (req, res) => {
    try {
      const result = await integration.dashboard();

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /*
   * POST /refresh
   *
   * تحديث فوري لجميع مؤشرات المركز.
   */
  router.post('/refresh', protect, async (req, res) => {
    try {
      const result = await integration.refresh();

      res.json({
        success: true,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        message: 'تم تحديث مركز القيادة التنفيذي',
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /*
   * GET /systems
   *
   * حالة جميع الأنظمة المتصلة.
   */
  router.get('/systems', async (req, res) => {
    try {
      const dashboard =
        await integration.dashboard();

      res.json({
        success: true,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        systems: dashboard.systems,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /*
   * GET /ai
   */
  router.get('/ai', async (req, res) => {
    try {
      const dashboard =
        await integration.dashboard();

      res.json({
        success: true,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        ai: dashboard.ai,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /*
   * GET /operations
   */
  router.get('/operations', async (req, res) => {
    try {
      const dashboard =
        await integration.dashboard();

      res.json({
        success: true,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        operations: dashboard.operations,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /*
   * GET /business
   */
  router.get('/business', async (req, res) => {
    try {
      const dashboard =
        await integration.dashboard();

      res.json({
        success: true,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        business: dashboard.business,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /*
   * GET /approvals
   */
  router.get('/approvals', async (req, res) => {
    try {
      const dashboard =
        await integration.dashboard();

      res.json({
        success: true,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        approvals: dashboard.approvals,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /*
   * GET /matrix
   *
   * مصفوفة مختصرة للواجهة.
   */
  router.get('/matrix', async (req, res) => {
    try {
      const dashboard =
        await integration.dashboard();

      const systems =
        dashboard.systems || {};

      const matrix = Object.entries(systems)
        .map(([name, system]) => ({
          name,
          available: Boolean(system.available),
          status: system.status || 'unknown'
        }));

      res.json({
        success: true,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        matrix,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /*
   * POST /analysis
   *
   * نقطة تحكم تحليلية.
   *
   * لا تنفذ قرارًا حساسًا تلقائيًا.
   */
  router.post('/analysis', protect, async (req, res) => {
    try {
      const dashboard =
        await integration.dashboard();

      const request = {
        type: req.body?.type || 'executive',
        question: req.body?.question || null,
        requestedAt: new Date().toISOString()
      };

      res.json({
        success: true,
        platform: 'EZ MEDIA',
        module: 'Executive Command Center',
        code: '119',
        analysis: {
          status: 'prepared',
          request,
          context: {
            ai: dashboard.ai,
            operations: dashboard.operations,
            systems: dashboard.systems
          },

          /*
           * التحليل النهائي من AI Core سيُربط
           * في المرحلة التالية.
           */
          requiresAIExecution: true,
          requiresHumanApproval: true
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

module.exports = {
  createExecutiveCommandCenterRouter
};
