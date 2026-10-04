/**
 * ================================================================
 * EZ MEDIA 11.0
 * CODE 59
 * ================================================================
 *
 * AI PROVIDER GATEWAY
 *
 * الملف:
 * src/services/ai-provider-gateway.js
 *
 * المسؤول عن:
 *
 * 1. الاتصال الفعلي بمزود الذكاء الاصطناعي
 * 2. OpenAI Responses API
 * 3. إدارة API Key
 * 4. اختيار النموذج
 * 5. اختيار النموذج حسب المهمة
 * 6. Retry
 * 7. Timeout
 * 8. تتبع الاستخدام
 * 9. استخراج output_text
 * 10. دعم Structured JSON
 * 11. دعم Web Search
 * 12. دعم File Search
 * 13. إدارة أخطاء المزود
 * 14. Health Check
 * 15. Model Discovery
 *
 * ================================================================
 */

'use strict';

const crypto = require('crypto');

let OpenAI = null;

try {
  OpenAI = require('openai');
} catch (error) {
  OpenAI = null;
}

/* ================================================================
 * 1. Constants
 * ================================================================ */

const SERVICE_NAME =
  'EZ MEDIA AI PROVIDER GATEWAY';

const VERSION =
  process.env.PLATFORM_VERSION ||
  '11.0.0';

const DEFAULT_MODEL =
  process.env.AI_MODEL ||
  'gpt-5.6';

const DEFAULT_FAST_MODEL =
  process.env.AI_FAST_MODEL ||
  'gpt-5.6-luna';

const DEFAULT_REASONING_MODEL =
  process.env.AI_REASONING_MODEL ||
  'gpt-5.6-sol';

const DEFAULT_TIMEOUT =
  Number(
    process.env.AI_PROVIDER_TIMEOUT_MS ||
    60000
  );

const DEFAULT_RETRIES =
  Number(
    process.env.AI_PROVIDER_MAX_RETRIES ||
    3
  );

/* ================================================================
 * 2. Helpers
 * ================================================================ */

function createId(prefix = 'provider') {

  return (
    `${prefix}_${Date.now()}_` +
    crypto.randomBytes(6).toString('hex')
  );

}

function now() {

  return new Date().toISOString();

}

function safeJson(value) {

  try {

    return JSON.parse(
      JSON.stringify(value)
    );

  } catch {

    return null;

  }

}

function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );

}

/* ================================================================
 * 3. AI Provider Gateway
 * ================================================================ */

class AIProviderGateway {

  constructor(options = {}) {

    this.name =
      SERVICE_NAME;

    this.version =
      VERSION;

    this.provider =
      options.provider ||
      process.env.AI_PROVIDER ||
      'openai';

    this.apiKey =
      options.apiKey ||
      process.env.OPENAI_API_KEY ||
      null;

    this.organization =
      options.organization ||
      process.env.OPENAI_ORG_ID ||
      null;

    this.project =
      options.project ||
      process.env.OPENAI_PROJECT_ID ||
      null;

    this.baseURL =
      options.baseURL ||
      process.env.OPENAI_BASE_URL ||
      undefined;

    this.defaultModel =
      options.defaultModel ||
      DEFAULT_MODEL;

    this.fastModel =
      options.fastModel ||
      DEFAULT_FAST_MODEL;

    this.reasoningModel =
      options.reasoningModel ||
      DEFAULT_REASONING_MODEL;

    this.timeout =
      options.timeout ||
      DEFAULT_TIMEOUT;

    this.maxRetries =
      options.maxRetries ??
      DEFAULT_RETRIES;

    this.logger =
      options.logger ||
      console;

    this.persistence =
      options.persistence ||
      null;

    this.client =
      null;

    this.started =
      false;

    this.statisticsData = {

      requests:
        0,

      successful:
        0,

      failed:
        0,

      retries:
        0,

      timeouts:
        0,

      totalDurationMs:
        0,

      inputTokens:
        0,

      outputTokens:
        0,

      totalTokens:
        0

    };

  }

  /* ==============================================================
   * 4. Initialize
   * ============================================================== */

  initialize() {

    if (this.started) {

      return this.status();

    }

    if (
      this.provider ===
      'openai'
    ) {

      if (!OpenAI) {

        throw new Error(
          'حزمة openai غير مثبتة. نفذ npm install openai'
        );

      }

      if (!this.apiKey) {

        this.logger.warn(
          '[EZ MEDIA AI] OPENAI_API_KEY غير موجود.'
        );

      }

      const options = {

        apiKey:
          this.apiKey || undefined,

        timeout:
          this.timeout,

        maxRetries:
          0

      };

      if (this.organization) {

        options.organization =
          this.organization;

      }

      if (this.project) {

        options.project =
          this.project;

      }

      if (this.baseURL) {

        options.baseURL =
          this.baseURL;

      }

      this.client =
        new OpenAI(
          options
        );

    }

    this.started =
      true;

    return this.status();

  }

  /* ==============================================================
   * 5. Status
   * ============================================================== */

  status() {

    return {

      service:
        this.name,

      version:
        this.version,

      provider:
        this.provider,

      started:
        this.started,

      configured:
        Boolean(
          this.apiKey
        ),

      sdkInstalled:
        Boolean(
          OpenAI
        ),

      defaultModel:
        this.defaultModel,

      fastModel:
        this.fastModel,

      reasoningModel:
        this.reasoningModel,

      timeout:
        this.timeout,

      maxRetries:
        this.maxRetries,

      statistics:
        this.statistics()

    };

  }

  /* ==============================================================
   * 6. Statistics
   * ============================================================== */

  statistics() {

    const requests =
      this.statisticsData.requests;

    return {

      ...this.statisticsData,

      averageDurationMs:
        requests
          ? Math.round(
              this.statisticsData
                .totalDurationMs /
              requests
            )
          : 0

    };

  }

  /* ==============================================================
   * 7. اختيار النموذج
   * ============================================================== */

  selectModel(
    operation,
    requestedModel
  ) {

    if (requestedModel) {

      return requestedModel;

    }

    const op =
      String(
        operation ||
        ''
      ).toLowerCase();

    const fastOperations = [

      'classification',

      'keyword-extraction',

      'entity-extraction',

      'sentiment-analysis',

      'moderation',

      'title-generation',

      'summarization',

      'translation'

    ];

    const reasoningOperations = [

      'fact-check',

      'risk-analysis',

      'automation-decision',

      'publishing-decision',

      'trend-analysis',

      'audience-analysis',

      'sponsorship-analysis',

      'advertising-analysis'

    ];

    if (
      fastOperations.includes(op)
    ) {

      return this.fastModel;

    }

    if (
      reasoningOperations.includes(op)
    ) {

      return this.reasoningModel;

    }

    return this.defaultModel;

  }

  /* ==============================================================
   * 8. بناء Input
   * ============================================================== */

  buildInput(options = {}) {

    if (
      options.input !==
      undefined
    ) {

      return options.input;

    }

    if (
      options.prompt
    ) {

      return options.prompt;

    }

    return '';

  }

  /* ==============================================================
   * 9. إنشاء Parameters
   * ============================================================== */

  buildRequest(options = {}) {

    const operation =
      options.operation ||
      'general';

    const model =
      this.selectModel(
        operation,
        options.model
      );

    const request = {

      model,

      input:
        this.buildInput(
          options
        )

    };

    if (
      options.instructions
    ) {

      request.instructions =
        options.instructions;

    }

    if (
      options.temperature !==
      undefined
    ) {

      request.temperature =
        options.temperature;

    }

    if (
      options.maxOutputTokens
    ) {

      request.max_output_tokens =
        options.maxOutputTokens;

    }

    if (
      options.reasoning
    ) {

      request.reasoning =
        options.reasoning;

    }

    if (
      options.tools &&
      Array.isArray(
        options.tools
      )
    ) {

      request.tools =
        options.tools;

    }

    if (
      options.toolChoice
    ) {

      request.tool_choice =
        options.toolChoice;

    }

    if (
      options.metadata
    ) {

      request.metadata =
        options.metadata;

    }

    if (
      options.text
    ) {

      request.text =
        options.text;

    }

    return request;

  }

  /* ==============================================================
   * 10. استخراج النص
   * ============================================================== */

  extractText(response) {

    if (!response) {

      return '';

    }

    if (
      typeof response.output_text ===
      'string'
    ) {

      return response.output_text;

    }

    /*
     * fallback إذا تغير شكل الاستجابة
     */

    const output =
      response.output;

    if (
      !Array.isArray(output)
    ) {

      return '';

    }

    const parts = [];

    for (
      const item of output
    ) {

      if (
        !item ||
        !Array.isArray(
          item.content
        )
      ) {

        continue;

      }

      for (
        const content
        of item.content
      ) {

        if (
          content &&
          typeof content.text ===
          'string'
        ) {

          parts.push(
            content.text
          );

        }

      }

    }

    return parts.join('\n');

  }

  /* ==============================================================
   * 11. استخراج الاستخدام
   * ============================================================== */

  extractUsage(response) {

    const usage =
      response?.usage;

    if (!usage) {

      return {

        inputTokens:
          0,

        outputTokens:
          0,

        totalTokens:
          0

      };

    }

    const inputTokens =
      Number(
        usage.input_tokens ||
        usage.prompt_tokens ||
        0
      );

    const outputTokens =
      Number(
        usage.output_tokens ||
        usage.completion_tokens ||
        0
      );

    const totalTokens =
      Number(
        usage.total_tokens ||
        inputTokens +
        outputTokens
      );

    return {

      inputTokens,

      outputTokens,

      totalTokens

    };

  }

  /* ==============================================================
   * 12. هل الخطأ قابل لإعادة المحاولة؟
   * ============================================================== */

  isRetryableError(error) {

    const status =
      error?.status ||
      error?.statusCode ||
      error?.response?.status;

    if (
      status === 408 ||
      status === 409 ||
      status === 429
    ) {

      return true;

    }

    if (
      status >= 500
    ) {

      return true;

    }

    const message =
      String(
        error?.message ||
        ''
      ).toLowerCase();

    return (

      message.includes(
        'timeout'
      ) ||

      message.includes(
        'temporarily'
      ) ||

      message.includes(
        'connection'
      ) ||

      message.includes(
        'rate limit'
      )

    );

  }

  /* ==============================================================
   * 13. Backoff
   * ============================================================== */

  getBackoff(
    attempt
  ) {

    const base =
      Number(
        process.env.AI_RETRY_BASE_MS ||
        1000
      );

    const max =
      Number(
        process.env.AI_RETRY_MAX_MS ||
        15000
      );

    const value =
      base *
      Math.pow(
        2,
        attempt
      );

    return Math.min(
      value,
      max
    );

  }

  /* ==============================================================
   * 14. الطلب الفعلي
   * ============================================================== */

  async request(
    options = {}
  ) {

    const requestId =
      createId(
        'ai_request'
      );

    const started =
      Date.now();

    this.statisticsData
      .requests++;

    if (!this.started) {

      this.initialize();

    }

    if (
      this.provider !==
      'openai'
    ) {

      throw new Error(
        `مزود AI غير مدعوم حاليًا: ${this.provider}`
      );

    }

    if (!this.client) {

      throw new Error(
        'AI Provider غير مهيأ.'
      );

    }

    if (!this.apiKey) {

      throw new Error(
        'OPENAI_API_KEY غير موجود.'
      );

    }

    const request =
      this.buildRequest(
        options
      );

    let lastError =
      null;

    for (
      let attempt = 0;
      attempt <=
      this.maxRetries;
      attempt++
    ) {

      try {

        const response =
          await this.client.responses.create(
            request
          );

        const duration =
          Date.now() -
          started;

        const usage =
          this.extractUsage(
            response
          );

        this.statisticsData
          .successful++;

        this.statisticsData
          .totalDurationMs +=
          duration;

        this.statisticsData
          .inputTokens +=
          usage.inputTokens;

        this.statisticsData
          .outputTokens +=
          usage.outputTokens;

        this.statisticsData
          .totalTokens +=
          usage.totalTokens;

        const result = {

          requestId,

          provider:
            this.provider,

          model:
            request.model,

          operation:
            options.operation ||
            'general',

          text:
            this.extractText(
              response
            ),

          usage,

          durationMs:
            duration,

          raw:
            options.includeRaw
              ? response
              : undefined

        };

        await this.persistUsage(
          result
        );

        return result;

      } catch (error) {

        lastError =
          error;

        if (
          attempt >=
          this.maxRetries ||
          !this.isRetryableError(
            error
          )
        ) {

          break;

        }

        this.statisticsData
          .retries++;

        const delay =
          this.getBackoff(
            attempt
          );

        this.logger.warn(
          `[EZ MEDIA AI] إعادة المحاولة ${attempt + 1}/${this.maxRetries} بعد ${delay}ms`
        );

        await sleep(
          delay
        );

      }

    }

    this.statisticsData
      .failed++;

    if (
      String(
        lastError?.message ||
        ''
      )
      .toLowerCase()
      .includes(
        'timeout'
      )
    ) {

      this.statisticsData
        .timeouts++;

    }

    throw lastError;

  }

  /* ==============================================================
   * 15. Structured JSON
   * ============================================================== */

  async json(
    options = {}
  ) {

    const request = {

      ...options,

      text: {

        format: {

          type:
            'json_object'

        }

      }

    };

    const result =
      await this.request(
        request
      );

    const text =
      result.text;

    try {

      return {

        ...result,

        json:
          JSON.parse(
            text
          )

      };

    } catch (error) {

      throw new Error(
        `تعذر تحويل استجابة AI إلى JSON: ${error.message}`
      );

    }

  }

  /* ==============================================================
   * 16. Web Search
   * ============================================================== */

  async webSearch(
    prompt,
    options = {}
  ) {

    return this.request({

      operation:
        options.operation ||
        'web-search',

      input:
        prompt,

      model:
        options.model,

      instructions:
        options.instructions,

      tools: [

        {
          type:
            'web_search'

        }

      ],

      includeRaw:
        options.includeRaw

    });

  }

  /* ==============================================================
   * 17. File Search
   * ============================================================== */

  async fileSearch(
    prompt,
    vectorStoreIds = [],
    options = {}
  ) {

    const tools = [

      {

        type:
          'file_search',

        vector_store_ids:
          vectorStoreIds

      }

    ];

    return this.request({

      operation:
        options.operation ||
        'file-search',

      input:
        prompt,

      tools,

      includeRaw:
        options.includeRaw

    });

  }

  /* ==============================================================
   * 18. قائمة النماذج
   * ============================================================== */

  async listModels() {

    if (!this.client) {

      this.initialize();

    }

    if (!this.client) {

      throw new Error(
        'AI client غير متاح.'
      );

    }

    const result =
      await this.client.models.list();

    return result;

  }

  /* ==============================================================
   * 19. التحقق من الاتصال
   * ============================================================== */

  async healthCheck() {

    const started =
      Date.now();

    try {

      if (!this.apiKey) {

        return {

          healthy:
            false,

          configured:
            false,

          provider:
            this.provider,

          message:
            'OPENAI_API_KEY غير موجود.'

        };

      }

      if (!this.client) {

        this.initialize();

      }

      /*
       * نستخدم models.list بدل استهلاك
       * طلب توليد حقيقي في Health Check.
       */

      await this.client.models.list();

      return {

        healthy:
          true,

        configured:
          true,

        provider:
          this.provider,

        durationMs:
          Date.now() -
          started

      };

    } catch (error) {

      return {

        healthy:
          false,

        configured:
          Boolean(
            this.apiKey
          ),

        provider:
          this.provider,

        error:
          error.message,

        durationMs:
          Date.now() -
          started

      };

    }

  }

  /* ==============================================================
   * 20. حفظ الاستخدام
   * ============================================================== */

  async persistUsage(
    result
  ) {

    if (
      !this.persistence
    ) {

      return;

    }

    try {

      if (
        typeof this.persistence
          .saveEvent ===
        'function'
      ) {

        await this.persistence
          .saveEvent({

            eventType:
              'ai.provider.request',

            source:
              'ai-provider-gateway',

            payload: {

              requestId:
                result.requestId,

              provider:
                result.provider,

              model:
                result.model,

              operation:
                result.operation,

              usage:
                result.usage,

              durationMs:
                result.durationMs

            }

          });

      }

    } catch (error) {

      this.logger.warn(
        '[EZ MEDIA AI] تعذر حفظ سجل الاستخدام:',
        error.message
      );

    }

  }

}

/* ================================================================
 * 21. Factory
 * ================================================================ */

function createAIProviderGateway(
  options = {}
) {

  return new AIProviderGateway(
    options
  );

}

/* ================================================================
 * 22. Export
 * ================================================================ */

module.exports = {

  AIProviderGateway,

  createAIProviderGateway,

  VERSION,

  SERVICE_NAME

};
