-- ============================================================================
-- Migration 009: Commerce & Generic Payment System
-- Adds: payment providers, offers, orders, payments, wallets, coupons, services
-- Supports any payment merchant via configurable adapters (API, redirect, manual)
-- ============================================================================

SET search_path TO academy_core, public;

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE offer_kind AS ENUM (
  'course_access',    -- grants enrollment to specific courses
  'credits',          -- adds test/assessment credits
  'unlimited_pass',   -- time-limited unlimited access
  'test_unlock',      -- unlocks a specific test result/bilan
  'pack',             -- bundle (credits + vouchers + services)
  'service'           -- coaching, mentoring, training session
);

CREATE TYPE order_status AS ENUM (
  'pending',      -- created, awaiting payment method selection
  'awaiting',     -- manual payment submitted, admin reviewing
  'processing',   -- payment in progress (API provider)
  'paid',         -- confirmed & fulfilled
  'rejected',     -- admin rejected manual payment
  'canceled',     -- user canceled
  'refunded'      -- refunded after payment
);

CREATE TYPE provider_integration_type AS ENUM (
  'api',       -- server-to-server API (Stripe, Flutterwave, NotchPay, etc.)
  'redirect',  -- redirect to external payment page
  'manual',    -- user pays externally, submits proof, admin validates
  'wallet'     -- internal credits / balance
);

CREATE TYPE coupon_kind AS ENUM (
  'percent',       -- percentage discount on price
  'credit',        -- adds credits to wallet
  'fixed_amount'   -- fixed amount discount
);

CREATE TYPE service_kind AS ENUM (
  'coaching',    -- one-on-one coaching session
  'mentoring',   -- ongoing mentoring
  'training'     -- group training session
);

CREATE TYPE service_status AS ENUM (
  'to_schedule',  -- awaiting scheduling
  'scheduled',    -- date confirmed
  'in_progress',  -- currently active
  'completed',    -- done
  'canceled'      -- canceled
);

-- ============================================================================
-- PAYMENT PROVIDERS — per-tenant merchant configuration
-- ============================================================================

CREATE TABLE payment_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    adapter_name VARCHAR(50) NOT NULL,
    integration_type provider_integration_type NOT NULL,
    display_name JSONB NOT NULL DEFAULT '{}',
    description JSONB DEFAULT '{}',
    logo_url TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    supported_currencies TEXT[] NOT NULL DEFAULT '{XAF}',
    webhook_path VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, adapter_name)
);

CREATE INDEX idx_payment_providers_tenant ON payment_providers(tenant_id);
CREATE INDEX idx_payment_providers_active ON payment_providers(tenant_id, is_active);

-- ============================================================================
-- OFFERS — products / plans sold by tenants
-- ============================================================================

CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(30) NOT NULL,
    kind offer_kind NOT NULL,
    name JSONB NOT NULL DEFAULT '{}',
    tagline JSONB DEFAULT '{}',
    description JSONB DEFAULT '{}',
    price INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'XAF',
    price_includes_tax BOOLEAN NOT NULL DEFAULT true,
    tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    -- fulfillment configuration
    credits INTEGER NOT NULL DEFAULT 0,
    days INTEGER NOT NULL DEFAULT 0,
    voucher_count INTEGER NOT NULL DEFAULT 0,
    services TEXT[] DEFAULT '{}',
    course_ids UUID[] DEFAULT '{}',
    assessment_ids UUID[] DEFAULT '{}',
    -- installments
    max_installments INTEGER NOT NULL DEFAULT 1,
    -- display
    features JSONB DEFAULT '[]',
    is_highlighted BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_offers_tenant ON offers(tenant_id);
CREATE INDEX idx_offers_active ON offers(tenant_id, is_active);
CREATE INDEX idx_offers_kind ON offers(kind);

-- ============================================================================
-- ORDERS
-- ============================================================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    ref VARCHAR(30) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id),
    offer_id UUID NOT NULL REFERENCES offers(id),
    -- context: what the purchase targets
    target_course_id UUID REFERENCES courses(id),
    target_assessment_id UUID,
    -- pricing
    amount INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    discount INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'XAF',
    coupon_code VARCHAR(30),
    -- installments
    installment_no INTEGER NOT NULL DEFAULT 1,
    installments_total INTEGER NOT NULL DEFAULT 1,
    parent_order_id UUID REFERENCES orders(id),
    due_at TIMESTAMPTZ,
    -- payment info
    provider_id UUID REFERENCES payment_providers(id),
    payment_method VARCHAR(50),
    status order_status NOT NULL DEFAULT 'pending',
    payer_name VARCHAR(200),
    payer_phone VARCHAR(50),
    proof_ref VARCHAR(100),
    provider_ref VARCHAR(100),
    -- sponsor link (third-party payment)
    sponsor_token VARCHAR(64) UNIQUE,
    -- admin
    admin_note TEXT,
    validated_by UUID REFERENCES users(id),
    -- timestamps
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_parent ON orders(parent_order_id);
CREATE INDEX idx_orders_sponsor ON orders(sponsor_token) WHERE sponsor_token IS NOT NULL;
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- ============================================================================
-- PAYMENTS — individual payment transactions/attempts
-- ============================================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    provider_id UUID NOT NULL REFERENCES payment_providers(id),
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'XAF',
    status VARCHAR(30) NOT NULL DEFAULT 'initiated',
    provider_ref VARCHAR(200),
    provider_response JSONB,
    redirect_url TEXT,
    callback_url TEXT,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider_ref ON payments(provider_ref) WHERE provider_ref IS NOT NULL;

-- ============================================================================
-- PAYMENT LOG — immutable audit trail
-- ============================================================================

CREATE TABLE payment_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID,
    order_id UUID,
    payment_id UUID,
    provider_adapter VARCHAR(50) NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    direction VARCHAR(10) NOT NULL DEFAULT 'inbound',
    payload JSONB NOT NULL DEFAULT '{}',
    http_status INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_log_order ON payment_log(order_id);
CREATE INDEX idx_payment_log_tenant ON payment_log(tenant_id);
CREATE INDEX idx_payment_log_created ON payment_log(created_at DESC);
CREATE INDEX idx_payment_log_adapter ON payment_log(provider_adapter);

-- ============================================================================
-- USER WALLETS — internal credits, passes, referrals
-- ============================================================================

CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    credits INTEGER NOT NULL DEFAULT 0,
    free_tests INTEGER NOT NULL DEFAULT 0,
    unlimited_until TIMESTAMPTZ,
    ref_code VARCHAR(20) NOT NULL,
    referred_by UUID REFERENCES users(id),
    referral_rewarded BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id),
    UNIQUE(tenant_id, ref_code)
);

CREATE INDEX idx_wallets_tenant ON user_wallets(tenant_id);
CREATE INDEX idx_wallets_user ON user_wallets(user_id);

-- ============================================================================
-- COUPONS
-- ============================================================================

CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(30) NOT NULL,
    kind coupon_kind NOT NULL,
    value INTEGER NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 1,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    org VARCHAR(200) DEFAULT '',
    source_order_id UUID REFERENCES orders(id),
    owner_id UUID REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_coupons_tenant ON coupons(tenant_id);
CREATE INDEX idx_coupons_active ON coupons(tenant_id, is_active);
CREATE INDEX idx_coupons_owner ON coupons(owner_id) WHERE owner_id IS NOT NULL;

-- ============================================================================
-- COUPON USES
-- ============================================================================

CREATE TABLE coupon_uses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID NOT NULL REFERENCES coupons(id),
    user_id UUID NOT NULL REFERENCES users(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(coupon_id, user_id)
);

CREATE INDEX idx_coupon_uses_coupon ON coupon_uses(coupon_id);
CREATE INDEX idx_coupon_uses_user ON coupon_uses(user_id);

-- ============================================================================
-- PURCHASED SERVICES
-- ============================================================================

CREATE TABLE purchased_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    kind service_kind NOT NULL,
    track VARCHAR(30),
    pace VARCHAR(20),
    status service_status NOT NULL DEFAULT 'to_schedule',
    request TEXT,
    scheduled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_services_tenant ON purchased_services(tenant_id);
CREATE INDEX idx_services_user ON purchased_services(user_id);
CREATE INDEX idx_services_status ON purchased_services(status);

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchased_services ENABLE ROW LEVEL SECURITY;

-- payment_providers
CREATE POLICY pp_select ON payment_providers FOR SELECT
  USING (academy_core.is_tenant_visible(tenant_id));
CREATE POLICY pp_insert ON payment_providers FOR INSERT
  WITH CHECK (academy_core.current_tenant_id() IS NULL OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY pp_update ON payment_providers FOR UPDATE
  USING (academy_core.current_tenant_id() IS NULL OR (
    current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
    AND academy_core.is_tenant_visible(tenant_id)));
CREATE POLICY pp_delete ON payment_providers FOR DELETE
  USING (academy_core.current_tenant_id() IS NULL OR (
    current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
    AND academy_core.is_tenant_visible(tenant_id)));

-- offers
CREATE POLICY offers_select ON offers FOR SELECT
  USING (academy_core.is_tenant_visible(tenant_id));
CREATE POLICY offers_insert ON offers FOR INSERT
  WITH CHECK (academy_core.current_tenant_id() IS NULL OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY offers_update ON offers FOR UPDATE
  USING (academy_core.current_tenant_id() IS NULL OR (
    current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
    AND academy_core.is_tenant_visible(tenant_id)));
CREATE POLICY offers_delete ON offers FOR DELETE
  USING (academy_core.current_tenant_id() IS NULL OR (
    current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
    AND academy_core.is_tenant_visible(tenant_id)));

-- orders
CREATE POLICY orders_select ON orders FOR SELECT
  USING (academy_core.current_tenant_id() IS NULL
    OR user_id = academy_core.current_user_id()
    OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
        AND academy_core.is_tenant_visible(tenant_id)));
CREATE POLICY orders_insert ON orders FOR INSERT
  WITH CHECK (academy_core.current_tenant_id() IS NULL
    OR user_id = academy_core.current_user_id()
    OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY orders_update ON orders FOR UPDATE
  USING (academy_core.current_tenant_id() IS NULL
    OR user_id = academy_core.current_user_id()
    OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
        AND academy_core.is_tenant_visible(tenant_id)));
CREATE POLICY orders_delete ON orders FOR DELETE
  USING (academy_core.current_tenant_id() IS NULL OR (
    current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
    AND academy_core.is_tenant_visible(tenant_id)));

-- payments
CREATE POLICY payments_select ON payments FOR SELECT
  USING (academy_core.current_tenant_id() IS NULL
    OR academy_core.is_tenant_visible(tenant_id));
CREATE POLICY payments_insert ON payments FOR INSERT
  WITH CHECK (academy_core.current_tenant_id() IS NULL
    OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY payments_update ON payments FOR UPDATE
  USING (academy_core.current_tenant_id() IS NULL
    OR academy_core.is_tenant_visible(tenant_id));

-- payment_log (read-only for app, insert always allowed)
CREATE POLICY pl_select ON payment_log FOR SELECT
  USING (academy_core.current_tenant_id() IS NULL
    OR academy_core.is_tenant_visible(tenant_id));
CREATE POLICY pl_insert ON payment_log FOR INSERT
  WITH CHECK (true);

-- user_wallets
CREATE POLICY wallets_select ON user_wallets FOR SELECT
  USING (academy_core.current_tenant_id() IS NULL
    OR user_id = academy_core.current_user_id()
    OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
        AND academy_core.is_tenant_visible(tenant_id)));
CREATE POLICY wallets_insert ON user_wallets FOR INSERT
  WITH CHECK (academy_core.current_tenant_id() IS NULL
    OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY wallets_update ON user_wallets FOR UPDATE
  USING (academy_core.current_tenant_id() IS NULL
    OR user_id = academy_core.current_user_id()
    OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
        AND academy_core.is_tenant_visible(tenant_id)));

-- coupons
CREATE POLICY coupons_select ON coupons FOR SELECT
  USING (academy_core.is_tenant_visible(tenant_id));
CREATE POLICY coupons_insert ON coupons FOR INSERT
  WITH CHECK (academy_core.current_tenant_id() IS NULL OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY coupons_update ON coupons FOR UPDATE
  USING (academy_core.current_tenant_id() IS NULL OR (
    current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
    AND academy_core.is_tenant_visible(tenant_id)));

-- coupon_uses
CREATE POLICY cu_select ON coupon_uses FOR SELECT
  USING (academy_core.current_tenant_id() IS NULL
    OR user_id = academy_core.current_user_id());
CREATE POLICY cu_insert ON coupon_uses FOR INSERT
  WITH CHECK (academy_core.current_tenant_id() IS NULL
    OR user_id = academy_core.current_user_id());

-- purchased_services
CREATE POLICY ps_select ON purchased_services FOR SELECT
  USING (academy_core.current_tenant_id() IS NULL
    OR user_id = academy_core.current_user_id()
    OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
        AND academy_core.is_tenant_visible(tenant_id)));
CREATE POLICY ps_insert ON purchased_services FOR INSERT
  WITH CHECK (academy_core.current_tenant_id() IS NULL
    OR tenant_id = academy_core.current_tenant_id());
CREATE POLICY ps_update ON purchased_services FOR UPDATE
  USING (academy_core.current_tenant_id() IS NULL
    OR (current_setting('app.current_user_role', true) IN ('admin_continental','admin_rec','admin_country')
        AND academy_core.is_tenant_visible(tenant_id)));

-- ============================================================================
-- UPDATED_AT TRIGGERS (for new tables that have updated_at)
-- ============================================================================

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
          'payment_providers', 'offers', 'orders', 'payments',
          'user_wallets', 'purchased_services'
        ])
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON academy_core.%I
             FOR EACH ROW EXECUTE FUNCTION academy_core.update_updated_at()',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS TO academy_app ROLE
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON payment_providers TO academy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON offers TO academy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO academy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO academy_app;
GRANT SELECT, INSERT ON payment_log TO academy_app;
GRANT SELECT, INSERT, UPDATE ON user_wallets TO academy_app;
GRANT SELECT, INSERT, UPDATE ON coupons TO academy_app;
GRANT SELECT, INSERT ON coupon_uses TO academy_app;
GRANT SELECT, INSERT, UPDATE ON purchased_services TO academy_app;
