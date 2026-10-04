"use strict";

/**
 * ============================================================
 * EZ MEDIA 11.0
 * CODE 76
 * INTELLIGENT MONETIZATION & REVENUE ENGINE
 * ============================================================
 *
 * Revenue Architecture
 *
 * ADVERTISING
 * SPONSORSHIP
 * SUBSCRIPTIONS
 * PACKAGES
 * PAID CONTENT
 * SERVICES
 * COMMISSIONS
 * INVOICES
 * PAYMENTS
 * REFUNDS
 * REVENUE FORECASTING
 * AI OPTIMIZATION
 *
 * مهم:
 * هذا المحرك لا ينفذ عملية مالية حقيقية بنفسه.
 * بوابة الدفع الفعلية يتم ربطها عبر Payment Provider
 * لاحقًا.
 */

const crypto = require("crypto");

function createIntelligentMonetizationEngine(
  options = {}
) {
  const {
    persistence = null,
    aiCore = null,
    aiOrchestrator = null,

    advertisingEngine = null,
    audienceEngine = null,
    publishingDistributionEngine = null,
    automationEngine = null,
    notificationService = null,
    eventBus = null,

    logger = console,

    currency =
      process.env.REVENUE_CURRENCY ||
      "SAR",

    taxRate =
      Number(
        process.env.REVENUE_TAX_RATE ||
        0
      ),

    forecastDays =
      Number(
        process.env.REVENUE_FORECAST_DAYS ||
        30
      )
  } = options;

  const state = {
    initialized: false,
    running: false,

    customers: new Map(),
    products: new Map(),
    subscriptions: new Map(),
    invoices: new Map(),
    payments: new Map(),
    refunds: new Map(),
    revenueEvents: new Map(),
    forecasts: new Map(),
    offers: new Map(),

    statistics: {
      customers: 0,
      products: 0,
      subscriptions: 0,
      invoices: 0,
      payments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      refunds: 0,
      revenue: 0,
      pendingRevenue: 0,
      forecastRevenue: 0,
      offers: 0
    }
  };

  /* ==========================================================
     HELPERS
  ========================================================== */

  function now() {
    return new Date().toISOString();
  }

  function id(prefix) {
    return (
      prefix +
      "_" +
      Date.now() +
      "_" +
      crypto
        .randomBytes(6)
        .toString("hex")
    );
  }

  function hash(value) {
    return crypto
      .createHash("sha256")
      .update(String(value || ""))
      .digest("hex");
  }

  function clean(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function number(
    value,
    fallback = 0
  ) {
    const result =
      Number(value);

    return Number.isFinite(result)
      ? result
      : fallback;
  }

  function clamp(
    value,
    min = 0,
    max = 100
  ) {
    return Math.min(
      max,
      Math.max(
        min,
        number(value)
      )
    );
  }

  function clone(value) {
    try {
      return JSON.parse(
        JSON.stringify(value)
      );
    } catch {
      return null;
    }
  }

  function emit(
    event,
    payload = {}
  ) {
    try {
      if (
        eventBus &&
        typeof eventBus.emit ===
          "function"
      ) {
        eventBus.emit(
          event,
          payload
        );
      }
    } catch (error) {
      logger.warn(
        "[CODE76] Event error:",
        error.message
      );
    }
  }

  /* ==========================================================
     DATABASE
  ========================================================== */

  async function ensureTables() {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_revenue_customers (
        id TEXT PRIMARY KEY,

        external_id TEXT,

        name TEXT,

        email TEXT,

        phone TEXT,

        customer_type TEXT DEFAULT 'customer',

        status TEXT DEFAULT 'active',

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_revenue_products (
        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        product_type TEXT NOT NULL,

        description TEXT,

        price NUMERIC DEFAULT 0,

        currency TEXT DEFAULT 'SAR',

        billing_period TEXT,

        status TEXT DEFAULT 'active',

        features JSONB DEFAULT '[]'::jsonb,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_revenue_subscriptions (
        id TEXT PRIMARY KEY,

        customer_id TEXT,

        product_id TEXT,

        status TEXT DEFAULT 'pending',

        amount NUMERIC DEFAULT 0,

        currency TEXT DEFAULT 'SAR',

        billing_period TEXT,

        start_at TIMESTAMPTZ,

        next_billing_at TIMESTAMPTZ,

        end_at TIMESTAMPTZ,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_revenue_invoices (
        id TEXT PRIMARY KEY,

        customer_id TEXT,

        invoice_number TEXT UNIQUE,

        status TEXT DEFAULT 'draft',

        subtotal NUMERIC DEFAULT 0,

        tax NUMERIC DEFAULT 0,

        total NUMERIC DEFAULT 0,

        paid_amount NUMERIC DEFAULT 0,

        currency TEXT DEFAULT 'SAR',

        due_at TIMESTAMPTZ,

        paid_at TIMESTAMPTZ,

        items JSONB DEFAULT '[]'::jsonb,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_revenue_payments (
        id TEXT PRIMARY KEY,

        invoice_id TEXT,

        customer_id TEXT,

        provider TEXT,

        provider_transaction_id TEXT,

        status TEXT DEFAULT 'pending',

        amount NUMERIC DEFAULT 0,

        currency TEXT DEFAULT 'SAR',

        payment_method TEXT,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_revenue_refunds (
        id TEXT PRIMARY KEY,

        payment_id TEXT,

        amount NUMERIC DEFAULT 0,

        currency TEXT DEFAULT 'SAR',

        reason TEXT,

        status TEXT DEFAULT 'pending',

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_revenue_events (
        id TEXT PRIMARY KEY,

        source TEXT,

        source_id TEXT,

        event_type TEXT NOT NULL,

        amount NUMERIC DEFAULT 0,

        currency TEXT DEFAULT 'SAR',

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_revenue_forecasts (
        id TEXT PRIMARY KEY,

        forecast_date DATE NOT NULL,

        predicted_revenue NUMERIC DEFAULT 0,

        confidence NUMERIC DEFAULT 0,

        methodology TEXT,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE TABLE IF NOT EXISTS ez_revenue_offers (
        id TEXT PRIMARY KEY,

        name TEXT NOT NULL,

        offer_type TEXT,

        discount_type TEXT,

        discount_value NUMERIC DEFAULT 0,

        start_at TIMESTAMPTZ,

        end_at TIMESTAMPTZ,

        usage_limit INTEGER,

        used_count INTEGER DEFAULT 0,

        status TEXT DEFAULT 'active',

        conditions JSONB DEFAULT '{}'::jsonb,

        metadata JSONB DEFAULT '{}'::jsonb,

        created_at TIMESTAMPTZ DEFAULT NOW(),

        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_revenue_payments_status
      ON ez_revenue_payments(status)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_revenue_events_created
      ON ez_revenue_events(created_at)
    `);

    await persistence.query(`
      CREATE INDEX IF NOT EXISTS
      idx_revenue_invoices_customer
      ON ez_revenue_invoices(customer_id)
    `);
  }

  /* ==========================================================
     INITIALIZE
  ========================================================== */

  async function initialize() {
    if (state.initialized) {
      return getStatus();
    }

    await ensureTables();

    state.initialized = true;

    emit(
      "revenue.initialized",
      {
        timestamp: now()
      }
    );

    return getStatus();
  }

  /* ==========================================================
     CUSTOMER
  ========================================================== */

  async function createCustomer(
    input = {}
  ) {
    const customer = {
      id:
        id("customer"),

      externalId:
        clean(
          input.externalId
        ),

      name:
        clean(
          input.name
        ),

      email:
        clean(
          input.email
        ),

      phone:
        clean(
          input.phone
        ),

      customerType:
        input.customerType ||
        "customer",

      status:
        input.status ||
        "active",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.customers.set(
      customer.id,
      customer
    );

    state.statistics.customers++;

    await persistCustomer(
      customer
    );

    return clone(
      customer
    );
  }

  /* ==========================================================
     PRODUCT / SERVICE
  ========================================================== */

  async function createProduct(
    input = {}
  ) {
    const product = {
      id:
        id("product"),

      name:
        clean(
          input.name
        ),

      productType:
        input.productType ||
        "service",

      description:
        clean(
          input.description
        ),

      price:
        Math.max(
          0,
          number(
            input.price
          )
        ),

      currency:
        input.currency ||
        currency,

      billingPeriod:
        input.billingPeriod ||
        null,

      status:
        input.status ||
        "active",

      features:
        Array.isArray(
          input.features
        )
          ? input.features
          : [],

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    if (
      !product.name
    ) {
      throw new Error(
        "Product name is required"
      );
    }

    state.products.set(
      product.id,
      product
    );

    state.statistics.products++;

    await persistProduct(
      product
    );

    return clone(
      product
    );
  }

  /* ==========================================================
     SUBSCRIPTION
  ========================================================== */

  async function createSubscription(
    input = {}
  ) {
    const product =
      state.products.get(
        input.productId
      );

    if (!product) {
      throw new Error(
        "Product not found"
      );
    }

    const subscription = {
      id:
        id("subscription"),

      customerId:
        clean(
          input.customerId
        ),

      productId:
        product.id,

      status:
        input.status ||
        "pending",

      amount:
        number(
          input.amount,
          product.price
        ),

      currency:
        input.currency ||
        product.currency,

      billingPeriod:
        input.billingPeriod ||
        product.billingPeriod,

      startAt:
        input.startAt ||
        now(),

      nextBillingAt:
        input.nextBillingAt ||
        null,

      endAt:
        input.endAt ||
        null,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.subscriptions.set(
      subscription.id,
      subscription
    );

    state.statistics.subscriptions++;

    await persistSubscription(
      subscription
    );

    return clone(
      subscription
    );
  }

  /* ==========================================================
     INVOICE
  ========================================================== */

  async function createInvoice(
    input = {}
  ) {
    const items =
      Array.isArray(
        input.items
      )
        ? input.items
        : [];

    const subtotal =
      items.reduce(
        (sum, item) =>
          sum +
          number(
            item.quantity,
            1
          ) *
            number(
              item.unitPrice
            ),
        0
      );

    const tax =
      number(
        input.tax,
        subtotal *
          (taxRate / 100)
      );

    const total =
      Math.max(
        0,
        subtotal + tax
      );

    const invoice = {
      id:
        id("invoice"),

      customerId:
        clean(
          input.customerId
        ),

      invoiceNumber:
        input.invoiceNumber ||
        `EZ-${Date.now()}`,

      status:
        input.status ||
        "draft",

      subtotal,

      tax,

      total,

      paidAmount:
        number(
          input.paidAmount
        ),

      currency:
        input.currency ||
        currency,

      dueAt:
        input.dueAt ||
        null,

      paidAt:
        input.paidAt ||
        null,

      items,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.invoices.set(
      invoice.id,
      invoice
    );

    state.statistics.invoices++;

    if (
      invoice.status !==
      "paid"
    ) {
      state.statistics.pendingRevenue +=
        invoice.total;
    }

    await persistInvoice(
      invoice
    );

    return clone(
      invoice
    );
  }

  /* ==========================================================
     PAYMENT RECORD
  ========================================================== */

  async function recordPayment(
    input = {}
  ) {
    const payment = {
      id:
        id("payment"),

      invoiceId:
        clean(
          input.invoiceId
        ),

      customerId:
        clean(
          input.customerId
        ),

      provider:
        clean(
          input.provider
        ),

      providerTransactionId:
        clean(
          input.providerTransactionId
        ),

      status:
        input.status ||
        "pending",

      amount:
        Math.max(
          0,
          number(
            input.amount
          )
        ),

      currency:
        input.currency ||
        currency,

      paymentMethod:
        clean(
          input.paymentMethod
        ),

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.payments.set(
      payment.id,
      payment
    );

    state.statistics.payments++;

    if (
      payment.status ===
      "succeeded"
    ) {
      state.statistics.successfulPayments++;

      state.statistics.revenue +=
        payment.amount;

      await recordRevenueEvent({
        source:
          "payment",

        sourceId:
          payment.id,

        eventType:
          "payment_succeeded",

        amount:
          payment.amount,

        currency:
          payment.currency,

        metadata:
          payment.metadata
      });
    }

    if (
      payment.status ===
      "failed"
    ) {
      state.statistics.failedPayments++;
    }

    await persistPayment(
      payment
    );

    return clone(
      payment
    );
  }

  /* ==========================================================
     REFUND
  ========================================================== */

  async function createRefund(
    input = {}
  ) {
    const refund = {
      id:
        id("refund"),

      paymentId:
        clean(
          input.paymentId
        ),

      amount:
        Math.max(
          0,
          number(
            input.amount
          )
        ),

      currency:
        input.currency ||
        currency,

      reason:
        clean(
          input.reason
        ),

      status:
        input.status ||
        "pending",

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.refunds.set(
      refund.id,
      refund
    );

    state.statistics.refunds++;

    if (
      refund.status ===
      "succeeded"
    ) {
      state.statistics.revenue -=
        refund.amount;
    }

    await persistRefund(
      refund
    );

    return clone(
      refund
    );
  }

  /* ==========================================================
     REVENUE EVENT
  ========================================================== */

  async function recordRevenueEvent(
    input = {}
  ) {
    const event = {
      id:
        id("revenue-event"),

      source:
        clean(
          input.source
        ),

      sourceId:
        clean(
          input.sourceId
        ),

      eventType:
        clean(
          input.eventType
        ),

      amount:
        number(
          input.amount
        ),

      currency:
        input.currency ||
        currency,

      metadata:
        input.metadata ||
        {},

      createdAt:
        now()
    };

    state.revenueEvents.set(
      event.id,
      event
    );

    await persistRevenueEvent(
      event
    );

    emit(
      "revenue.event",
      {
        event:
          clone(event)
      }
    );

    return clone(
      event
    );
  }

  /* ==========================================================
     OFFER
  ========================================================== */

  async function createOffer(
    input = {}
  ) {
    const offer = {
      id:
        id("offer"),

      name:
        clean(
          input.name
        ),

      offerType:
        input.offerType ||
        "discount",

      discountType:
        input.discountType ||
        "percentage",

      discountValue:
        Math.max(
          0,
          number(
            input.discountValue
          )
        ),

      startAt:
        input.startAt ||
        now(),

      endAt:
        input.endAt ||
        null,

      usageLimit:
        input.usageLimit
          ? number(
              input.usageLimit
            )
          : null,

      usedCount: 0,

      status:
        input.status ||
        "active",

      conditions:
        input.conditions ||
        {},

      metadata:
        input.metadata ||
        {},

      createdAt:
        now(),

      updatedAt:
        now()
    };

    state.offers.set(
      offer.id,
      offer
    );

    state.statistics.offers++;

    await persistOffer(
      offer
    );

    return clone(
      offer
    );
  }

  /* ==========================================================
     REVENUE SUMMARY
  ========================================================== */

  function getRevenueSummary() {
    const payments =
      Array.from(
        state.payments.values()
      );

    const refunds =
      Array.from(
        state.refunds.values()
      );

    const successful =
      payments.filter(
        payment =>
          payment.status ===
          "succeeded"
      );

    const gross =
      successful.reduce(
        (sum, payment) =>
          sum +
          payment.amount,
        0
      );

    const refundTotal =
      refunds
        .filter(
          refund =>
            refund.status ===
            "succeeded"
        )
        .reduce(
          (sum, refund) =>
            sum +
            refund.amount,
          0
        );

    const net =
      Math.max(
        0,
        gross -
          refundTotal
      );

    return {
      currency,

      grossRevenue:
        Number(
          gross.toFixed(2)
        ),

      refunds:
        Number(
          refundTotal.toFixed(2)
        ),

      netRevenue:
        Number(
          net.toFixed(2)
        ),

      pendingRevenue:
        Number(
          state.statistics
            .pendingRevenue
            .toFixed(2)
        ),

      successfulPayments:
        successful.length,

      failedPayments:
        payments.filter(
          payment =>
            payment.status ===
            "failed"
        ).length
    };
  }

  /* ==========================================================
     REVENUE FORECAST
  ========================================================== */

  async function forecastRevenue(
    input = {}
  ) {
    const days =
      Math.max(
        1,
        number(
          input.days,
          forecastDays
        )
      );

    const summary =
      getRevenueSummary();

    const events =
      Array.from(
        state.revenueEvents.values()
      );

    const recent =
      events.filter(
        event => {
          const time =
            new Date(
              event.createdAt
            ).getTime();

          return (
            Date.now() -
              time <=
            30 *
              24 *
              60 *
              60 *
              1000
          );
        }
      );

    const recentRevenue =
      recent.reduce(
        (sum, event) =>
          sum +
          number(
            event.amount
          ),
        0
      );

    const dailyAverage =
      recentRevenue /
      30;

    const baseline =
      dailyAverage *
      days;

    let aiForecast = null;

    if (
      aiCore &&
      typeof aiCore.request ===
        "function"
    ) {
      try {
        aiForecast =
          await aiCore.request({
            operation:
              "revenue-forecast",

            summary,

            days,

            recentRevenue,

            dailyAverage
          });
      } catch (error) {
        logger.warn(
          "[CODE76] AI forecast failed:",
          error.message
        );
      }
    }

    const predictedRevenue =
      number(
        aiForecast?.predictedRevenue,
        baseline
      );

    const confidence =
      clamp(
        aiForecast?.confidence ||
          (
            recent.length >=
            10
              ? 75
              : 45
          )
      );

    const forecast = {
      id:
        id("forecast"),

      days,

      predictedRevenue:

        Number(
          predictedRevenue.toFixed(
            2
          )
        ),

      currency,

      confidence,

      methodology:
        aiForecast
          ? "AI + historical revenue"
          : "historical revenue baseline",

      dailyAverage:
        Number(
          dailyAverage.toFixed(
            2
          )
        ),

      createdAt:
        now()
    };

    state.forecasts.set(
      forecast.id,
      forecast
    );

    state.statistics.forecastRevenue =
      forecast.predictedRevenue;

    await persistForecast(
      forecast
    );

    return clone(
      forecast
    );
  }

  /* ==========================================================
     AI REVENUE OPTIMIZATION
  ========================================================== */

  async function optimizeRevenue() {
    const summary =
      getRevenueSummary();

    let advertising = null;

    if (
      advertisingEngine &&
      typeof advertisingEngine
        .getStatistics ===
        "function"
    ) {
      advertising =
        advertisingEngine
          .getStatistics();
    }

    let audience = null;

    if (
      audienceEngine &&
      typeof audienceEngine
        .getStatistics ===
        "function"
    ) {
      audience =
        audienceEngine
          .getStatistics();
    }

    if (
      !aiCore ||
      typeof aiCore.request !==
        "function"
    ) {
      return {
        optimized:
          false,

        reason:
          "AI Core unavailable",

        summary,

        advertising,

        audience
      };
    }

    try {
      const result =
        await aiCore.request({
          operation:
            "revenue-optimization",

          revenue:
            summary,

          advertising,

          audience,

          products:
            Array.from(
              state.products.values()
            ),

          subscriptions:
            Array.from(
              state.subscriptions.values()
            )
        });

      return {
        optimized:
          true,

        summary,

        advertising,

        audience,

        recommendations:
          result?.recommendations ||
          [],

        pricing:
          result?.pricing ||
          [],

        offers:
          result?.offers ||
          [],

        forecast:
          result?.forecast ||
          null,

        confidence:
          clamp(
            result?.confidence ||
              0
          )
      };
    } catch (error) {
      return {
        optimized:
          false,

        error:
          error.message
      };
    }
  }

  /* ==========================================================
     DASHBOARD
  ========================================================== */

  async function getDashboard() {
    const revenue =
      getRevenueSummary();

    const forecast =
      await forecastRevenue({
        days:
          forecastDays
      });

    return {
      revenue,

      forecast,

      products:
        state.products.size,

      subscriptions:
        state.subscriptions.size,

      invoices:
        state.invoices.size,

      payments:
        state.payments.size,

      refunds:
        state.refunds.size,

      offers:
        state.offers.size,

      advertising:
        advertisingEngine &&
        typeof advertisingEngine
          .getStatistics ===
          "function"
          ? advertisingEngine
              .getStatistics()
          : null,

      audience:
        audienceEngine &&
        typeof audienceEngine
          .getStatistics ===
          "function"
          ? audienceEngine
              .getStatistics()
          : null,

      timestamp:
        now()
    };
  }

  /* ==========================================================
     DATABASE PERSISTENCE
  ========================================================== */

  async function persistCustomer(
    customer
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_revenue_customers (
        id,
        external_id,
        name,
        email,
        phone,
        customer_type,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      ON CONFLICT(id)
      DO UPDATE SET
        name =
          EXCLUDED.name,
        email =
          EXCLUDED.email,
        phone =
          EXCLUDED.phone,
        status =
          EXCLUDED.status,
        metadata =
          EXCLUDED.metadata,
        updated_at =
          EXCLUDED.updated_at
      `,
      [
        customer.id,
        customer.externalId,
        customer.name,
        customer.email,
        customer.phone,
        customer.customerType,
        customer.status,
        JSON.stringify(
          customer.metadata
        ),
        customer.createdAt,
        customer.updatedAt
      ]
    );
  }

  async function persistProduct(
    product
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_revenue_products (
        id,
        name,
        product_type,
        description,
        price,
        currency,
        billing_period,
        status,
        features,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      `,
      [
        product.id,
        product.name,
        product.productType,
        product.description,
        product.price,
        product.currency,
        product.billingPeriod,
        product.status,
        JSON.stringify(
          product.features
        ),
        JSON.stringify(
          product.metadata
        ),
        product.createdAt,
        product.updatedAt
      ]
    );
  }

  async function persistSubscription(
    subscription
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_revenue_subscriptions (
        id,
        customer_id,
        product_id,
        status,
        amount,
        currency,
        billing_period,
        start_at,
        next_billing_at,
        end_at,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
      )
      `,
      [
        subscription.id,
        subscription.customerId,
        subscription.productId,
        subscription.status,
        subscription.amount,
        subscription.currency,
        subscription.billingPeriod,
        subscription.startAt,
        subscription.nextBillingAt,
        subscription.endAt,
        JSON.stringify(
          subscription.metadata
        ),
        subscription.createdAt,
        subscription.updatedAt
      ]
    );
  }

  async function persistInvoice(
    invoice
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_revenue_invoices (
        id,
        customer_id,
        invoice_number,
        status,
        subtotal,
        tax,
        total,
        paid_amount,
        currency,
        due_at,
        paid_at,
        items,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15
      )
      `,
      [
        invoice.id,
        invoice.customerId,
        invoice.invoiceNumber,
        invoice.status,
        invoice.subtotal,
        invoice.tax,
        invoice.total,
        invoice.paidAmount,
        invoice.currency,
        invoice.dueAt,
        invoice.paidAt,
        JSON.stringify(
          invoice.items
        ),
        JSON.stringify(
          invoice.metadata
        ),
        invoice.createdAt,
        invoice.updatedAt
      ]
    );
  }

  async function persistPayment(
    payment
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_revenue_payments (
        id,
        invoice_id,
        customer_id,
        provider,
        provider_transaction_id,
        status,
        amount,
        currency,
        payment_method,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      `,
      [
        payment.id,
        payment.invoiceId,
        payment.customerId,
        payment.provider,
        payment.providerTransactionId,
        payment.status,
        payment.amount,
        payment.currency,
        payment.paymentMethod,
        JSON.stringify(
          payment.metadata
        ),
        payment.createdAt,
        payment.updatedAt
      ]
    );
  }

  async function persistRefund(
    refund
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_revenue_refunds (
        id,
        payment_id,
        amount,
        currency,
        reason,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      `,
      [
        refund.id,
        refund.paymentId,
        refund.amount,
        refund.currency,
        refund.reason,
        refund.status,
        JSON.stringify(
          refund.metadata
        ),
        refund.createdAt,
        refund.updatedAt
      ]
    );
  }

  async function persistRevenueEvent(
    event
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_revenue_events (
        id,
        source,
        source_id,
        event_type,
        amount,
        currency,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7
      )
      `,
      [
        event.id,
        event.source,
        event.sourceId,
        event.eventType,
        event.amount,
        event.currency,
        JSON.stringify(
          event.metadata
        )
      ]
    );
  }

  async function persistForecast(
    forecast
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_revenue_forecasts (
        id,
        forecast_date,
        predicted_revenue,
        confidence,
        methodology,
        metadata
      )
      VALUES (
        $1,$2,$3,$4,$5,$6
      )
      `,
      [
        forecast.id,
        new Date(
          forecast.createdAt
        ),
        forecast.predictedRevenue,
        forecast.confidence,
        forecast.methodology,
        JSON.stringify(
          forecast
        )
      ]
    );
  }

  async function persistOffer(
    offer
  ) {
    if (
      !persistence ||
      typeof persistence.query !==
        "function"
    ) {
      return;
    }

    await persistence.query(
      `
      INSERT INTO ez_revenue_offers (
        id,
        name,
        offer_type,
        discount_type,
        discount_value,
        start_at,
        end_at,
        usage_limit,
        used_count,
        status,
        conditions,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
      )
      `,
      [
        offer.id,
        offer.name,
        offer.offerType,
        offer.discountType,
        offer.discountValue,
        offer.startAt,
        offer.endAt,
        offer.usageLimit,
        offer.usedCount,
        offer.status,
        JSON.stringify(
          offer.conditions
        ),
        JSON.stringify(
          offer.metadata
        ),
        offer.createdAt,
        offer.updatedAt
      ]
    );
  }

  /* ==========================================================
     STATUS
  ========================================================== */

  function getStatistics() {
    return {
      ...state.statistics,

      customerCache:
        state.customers.size,

      productCache:
        state.products.size,

      subscriptionCache:
        state.subscriptions.size,

      invoiceCache:
        state.invoices.size,

      paymentCache:
        state.payments.size,

      refundCache:
        state.refunds.size,

      revenueEventCache:
        state.revenueEvents.size,

      forecastCache:
        state.forecasts.size
    };
  }

  function getStatus() {
    return {
      service:
        "EZ MEDIA Intelligent Monetization & Revenue Engine",

      code:
        "76",

      version:
        "11.0.0",

      initialized:
        state.initialized,

      running:
        state.running,

      currency,

      taxRate,

      forecastDays,

      integrations: {
        persistence:
          Boolean(
            persistence
          ),

        aiCore:
          Boolean(
            aiCore
          ),

        aiOrchestrator:
          Boolean(
            aiOrchestrator
          ),

        advertising:
          Boolean(
            advertisingEngine
          ),

        audience:
          Boolean(
            audienceEngine
          ),

        publishing:
          Boolean(
            publishingDistributionEngine
          ),

        automation:
          Boolean(
            automationEngine
          )
      },

      statistics:
        getStatistics(),

      timestamp:
        now()
    };
  }

  async function health() {
    let database = {
      connected:
        false
    };

    if (
      persistence &&
      typeof persistence.health ===
        "function"
    ) {
      try {
        database =
          await persistence.health();
      } catch {
        database = {
          connected:
            false
        };
      }
    }

    return {
      ok:
        state.initialized,

      running:
        state.running,

      database,

      timestamp:
        now()
    };
  }

  function start() {
    state.running =
      true;

    emit(
      "revenue.started",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  function stop() {
    state.running =
      false;

    emit(
      "revenue.stopped",
      {
        timestamp:
          now()
      }
    );

    return getStatus();
  }

  return {
    initialize,
    start,
    stop,

    createCustomer,
    createProduct,
    createSubscription,

    createInvoice,
    recordPayment,
    createRefund,

    recordRevenueEvent,

    createOffer,

    getRevenueSummary,
    forecastRevenue,
    optimizeRevenue,
    getDashboard,

    getStatistics,
    getStatus,
    health
  };
}

module.exports = {
  createIntelligentMonetizationEngine
};
