'use strict';

const express = require('express');

function createIntelligentMediaEventIntelligenceRouter({
  engine,
  operationsEngine
} = {}) {
  const router = express.Router();

  if (!engine) {
    router.get('/health', (req, res) => {
      res.status(503).json({
        success: false,
        service: 'intelligent-media-event-intelligence',
        status: 'unavailable',
        message: 'محرك تحليل الأحداث غير متاح'
      });
    });

    return router;
  }

  router.get('/health', (req, res) => {
    res.json(engine.health());
  });

  router.post('/analyze', async (req, res) => {
    try {
      const result = engine.analyze(req.body || {});

      if (!result.success) {
        return res.status(503).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error(
        '[EVENT INTELLIGENCE] analyze error:',
        error
      );

      res.status(500).json({
        success: false,
        error: 'EVENT_ANALYSIS_FAILED',
        message: error.message
      });
    }
  });

  router.post('/process', async (req, res) => {
    try {
      const result = await engine.processEvent(
        req.body || {}
      );

      if (!result.success) {
        return res.status(503).json(result);
      }

      /*
       * إذا كان مركز العمليات متصلًا:
       * نرسل الحدث المحلل إليه لإنشاء عملية.
       *
       * لا ننفذ النشر الخارجي تلقائيًا.
       */
      if (
        operationsEngine &&
        typeof operationsEngine.ingestEvent === 'function'
      ) {
        const operationResult =
          await operationsEngine.ingestEvent({
            ...req.body,
            ...result.analysis.event,
            aiAnalysis: result.analysis
          });

        return res.json({
          success: true,
          analysis: result.analysis,
          operation: operationResult
        });
      }

      res.json({
        success: true,
        analysis: result.analysis,
        operation: {
          connected: false,
          message:
            'تم تحليل الحدث، لكن مركز العمليات غير متصل بعد'
        }
      });
    } catch (error) {
      console.error(
        '[EVENT INTELLIGENCE] process error:',
        error
      );

      res.status(500).json({
        success: false,
        error: 'EVENT_PROCESSING_FAILED',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = {
  createIntelligentMediaEventIntelligenceRouter
};
