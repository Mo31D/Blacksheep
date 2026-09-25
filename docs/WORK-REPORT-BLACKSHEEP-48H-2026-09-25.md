# Black Sheep — تقرير تنفيذ ومراجعة آخر 48 ساعة

**تاريخ المراجعة:** 25 سبتمبر 2026  
**نافذة التدقيق:** من 23 سبتمبر 2026 الساعة 16:22 UTC إلى 25 سبتمبر 2026 الساعة 16:22 UTC  
**المستودع:** `Mo31D/Blacksheep`  
**الفرع:** `main`  
**GitHub HEAD الذي تم التدقيق عليه قبل إنشاء هذا التقرير:** `1ea259314b9fd58a66fa69363e20fc14b7792db2`  
**Production runtime source:** `8c5462388648235acd3a41b853d1adee057a11a7`

> هذا التقرير مبني على مراجعة مباشرة لـ GitHub وCloudflare وResend، وليس على ملخصات المحادثات وحدها.  
> تم تجنب تسجيل عناوين العملاء أو الأسرار أو مفاتيح API داخل التقرير.

---

## 1. الخلاصة التنفيذية

خلال آخر 48 ساعة حدث تحول جذري في المشروع على مستويين متوازيين:

1. **الواجهة العامة والكتالوج** انتقلت إلى بنية أكثر نضجاً للبحث والاكتشاف، مع صفحات منتجات ثابتة canonical، بيانات منظمة، تحسينات Romney's / Peter Rabbit / Highland Cow / Hawkshead Relish، وتثبيت الكتالوج الحالي.
2. **الموقع أصبح فعلياً منصة Commerce V1 + Admin V2** بدلاً من موقع كتالوج فقط:
   - Basket وCheckout وطلب حقيقي.
   - Cloudflare Worker كـ Commerce API.
   - D1 كقاعدة بيانات للطلبات.
   - Admin خاص وآمن.
   - مراجعة الطلب وتعديل الكميات/البدائل/التوصيل.
   - Secure customer review page.
   - Payment request workflow.
   - Refund ledger.
   - تقارير تشغيلية.
   - transactional email عبر Resend.
   - signed delivery webhooks.
   - staging وproduction منفصلان.
   - migrations واختبارات E2E وحماية من التكرار والتزامن.

**Production Admin V2 أصبح Live بالفعل.**  
المتبقي حالياً ليس إعادة بناء أو migration جديدة، بل **post-release validation / polish** وبعض أعمال hardening التشغيلية.

---

## 2. حجم العمل الفعلي على GitHub خلال 48 ساعة

تم رصد **864 commit** على `main` داخل نافذة التدقيق.

### توزيع commits حسب اليوم

| اليوم UTC | عدد commits |
|---|---:|
| 23 سبتمبر 2026 | 376 |
| 24 سبتمبر 2026 | 244 |
| 25 سبتمبر 2026 | 244 |
| **الإجمالي** | **864** |

أول commit داخل النافذة:
- `f534583997128cf747d9fe5236c85543ca9d0de8`
- `assets: prepare Highland Cow image upload folder`

آخر commit تم التدقيق عليه:
- `1ea259314b9fd58a66fa69363e20fc14b7792db2`
- `docs: complete Phase 13 release handoff`

### مقارنة الشجرة خلال النافذة

مقارنة GitHub بين commit السابق للنافذة وHEAD أعادت الحد الأقصى البالغ **300 ملف** في استجابة compare، لذلك الأرقام التالية تخص الملفات التي أعادها GitHub وليست دليلاً على أن 300 هو إجمالي كل الملفات المتأثرة:

- 262 ملفاً مضافاً.
- 37 ملفاً معدلاً.
- ملف واحد محذوف.
- 19,905 سطر إضافة.
- 168 سطر حذف.
- 20,073 تغييراً إجمالياً داخل مجموعة الملفات المعادة.

أكبر مناطق التغيير:

| المسار | عدد الملفات في compare |
|---|---:|
| `commerce/` | 77 |
| `images/` | 90 |
| `products/` | 54 |
| `docs/` | 24 |
| `.github/` | 17 |
| root | 35 |

أكبر الملفات التي نمت خلال النافذة تشمل:
- `commerce/src/generated/catalog.ts`
- `commerce/src/data/order-revisions.ts`
- `commerce/src/routes/admin.ts`
- `commerce/src/data/customer-review.ts`
- `commerce/src/data/admin-orders.ts`
- `commerce/src/data/refunds.ts`
- `commerce/src/data/admin-reports-v2.ts`
- اختبارات E2E واختبارات concurrency/refunds/webhooks/admin.

هذا يوضح أن التغيير لم يكن تجميلياً؛ تم إنشاء طبقة backend وoperations كاملة تقريباً.

---

## 3. التغييرات الجذرية في الواجهة والكتالوج

### 3.1 بنية صفحات المنتجات والـSEO

خلال 23 سبتمبر تم تنفيذ حجم كبير من العمل على:
- صفحات `/products/<slug>.html` الثابتة.
- canonical URLs.
- Open Graph / Twitter metadata.
- JSON-LD / Product / Breadcrumb / Store entity structure.
- prerendered collection content.
- تنظيف روابط navigation القديمة.
- إزالة/تعطيل صفحات فارغة أو legacy routes.
- توصيل collection cards مباشرة بصفحات المنتجات الثابتة.
- تحسين قابلية القراءة لمحركات البحث وAI crawlers.
- إضافة Search Readiness checks لمنع regressions.

تم أيضاً اكتشاف وإصلاح مشكلة سابقة كانت تظهر جزءاً من Open Graph markup كنص مرئي أعلى بعض الصفحات.

### 3.2 حالة الكتالوج الحالية

تمت قراءة `assets/catalog.js` مباشرة من HEAD الحالي:

- **146 منتجاً**
- **146 ID فريد**
- **146 slug فريد**

التوزيع:

| القسم | العدد |
|---|---:|
| Gifts | 64 |
| Luxury Lakes Ice Cream | 12 |
| Romney's / confectionery | 55 |
| Hawkshead Relish | 15 |
| **الإجمالي** | **146** |

كما توجد:
- 14 records تحمل `imagePending: true`.
- 3 منتجات محددة `out-of-stock`.

### 3.3 Romney's

تم تحويل Romney's إلى section أكثر انتظاماً:
- deterministic static builder.
- source-map داخلي.
- verified official product data.
- official image syncing.
- owner pricing.
- builder drift checks.
- منع تسريب supplier pricing إلى الواجهة العامة.
- إصلاحات لهويات المنتجات والأوزان والأسماء.
- static product pages قابلة للتحقق آلياً.

### 3.4 Peter Rabbit / Highland Cow / Hawkshead Relish

تم خلال النافذة:
- إثراء صفحات Peter Rabbit.
- إضافة/تحسين Highland Cow products وصور ومنتجات وصلت وأخرى pending.
- توسيع Hawkshead Relish ببيانات وأسعار وصور رسمية/مقدمة من المالك.
- تثبيت Product Information وحقائق المنتج.
- إضافة حالات مخزون أكثر وضوحاً.
- تحسين Full Range والـcollection surfaces.

---

## 4. التحول إلى Commerce V1 حقيقي

المشروع لم يعد يعتمد على email كنسخة وحيدة للطلب.

### البنية الحالية

```text
Static storefront / GitHub Pages
        |
        v
Basket + Checkout
        |
        v
Cloudflare Worker Commerce API
        |
        +--> Turnstile verification
        +--> server-authoritative catalogue/pricing
        +--> rate limiting
        +--> idempotency
        |
        v
Cloudflare D1
        |
        +--> orders / order_items / events
        +--> revisions / adjustments
        +--> refunds
        +--> customer review tokens/messages
        +--> email webhook ledger
        |
        +--> Private Admin V2
        +--> Resend transactional email
```

### الخصائص المنفذة

- Basket حقيقي.
- Checkout للـcollection والـdelivery.
- server-side product validation.
- server-authoritative prices.
- Turnstile verification من السيرفر.
- idempotency لمنع duplicate orders.
- rate limiting.
- D1 persistence.
- order reference.
- owner/customer notifications.
- legal pages مرتبطة بالcheckout.
- order lifecycle.
- staging وproduction data منفصلان.

---

## 5. Admin V2 — ما تم بناؤه فعلياً

تم إنشاء Admin خاص وليس مجرد صفحة حالة.

### 5.1 تسجيل الدخول والأمان

الكود الحالي يطبق:
- OTP login.
- صلاحية OTP لمدة 10 دقائق.
- تخزين hash للكود وليس الكود نفسه.
- constant-time comparison.
- attempt handling.
- session token hashing.
- session expiry.
- cookie:
  - `HttpOnly`
  - `Secure`
  - `SameSite=Strict`
  - scoped إلى `/admin`.
- `Cache-Control: no-store`.
- Content Security Policy في مسارات Admin.
- same-origin protection للـAdmin mutations.
- exact CORS origins في Commerce API.

### 5.2 Order workspace

الـAdmin يدعم الآن:
- قائمة الطلبات.
- filtering/status tabs.
- order detail.
- customer/fulfilment details.
- original request snapshot.
- revisions مستقلة بدلاً من الكتابة فوق الطلب الأصلي.
- تقليل الكمية.
- unavailable item.
- substitute item.
- إضافة منتج.
- remove / restore item.
- تغيير Collection ↔ Delivery.
- delivery charge.
- delivery address snapshot.
- customer-facing message.
- internal note منفصل.
- explicit adjustments.
- final reviewed total.
- finalize quote.

### 5.3 Secure customer review

تم إنشاء flow منفصل للعميل:
- token غير قابل للتخمين.
- token hash مخزن في D1.
- expiry.
- revoked-state support.
- الصفحة تعرض original vs revised order.
- تظهر substitutions / unavailable / reduced / adjustments.
- العميل يستطيع accept أو decline.
- يستطيع إرسال سؤال للمتجر.
- رابط payment request يأتي من السيرفر.
- الصفحة `no-store` و`referrer-policy: no-referrer`.

### 5.4 Refunds

تم إنشاء refund ledger قابل للتدقيق:
- partial refund.
- full refund.
- reason.
- method.
- external reference.
- owner identity.
- idempotency.
- concurrency safeguards.
- refund notifications.

**مهم:** الـAdmin لا يدعي أنه يعيد المال بنفسه. الواجهة تنص بوضوح على أن الاسترداد المالي يتم خارج النظام ثم يتم تسجيله في الـledger.

### 5.5 Reports

التقارير الحالية تشمل:
- revenue.
- orders.
- average order value.
- paid conversion.
- refund rate.
- refund reasons.
- product performance.
- availability loss.
- cancellation reasons.
- operational timing.
- ageing queues.
- transactional email failures.
- customer insights.
- CSV export.
- dashboard attention queue.

---

## 6. Email V2 وResend

### 6.1 Domain

المراجعة المباشرة لـResend تؤكد:

- domain: `theblacksheepshop.co.uk`
- status: **verified**
- region: `eu-west-1`
- sending: **enabled**
- receiving: disabled
- open tracking: off
- click tracking: off

### 6.2 transactional emails

خلال نافذة الـ48 ساعة:

- **45 sent**
- **45 delivered**
- **0 bounced**
- **0 failed**
- **0 delayed**
- **0 complained**
- **0 suppressed**
- delivery rate في نافذة التدقيق: **100%**

هذه أرقام فترة قصيرة واختبارية وليست دليلاً إحصائياً طويل المدى على deliverability، لكنها تؤكد أن التدفقات التي أرسلت خلال هذه النافذة وصلت وفق Resend.

### 6.3 أنواع الرسائل التي ظهرت فعلياً

تمت مشاهدة رسائل من أنواع:
- order acknowledgement.
- owner new-order notification.
- admin OTP.
- payment request.
- payment received.
- ready for collection.
- refund notification.
- customer question.
- staging webhook test messages.

### 6.4 Webhooks

يوجد webhook منفصل لكل environment.

**Production**
- endpoint: `https://api.theblacksheepshop.co.uk/webhooks/resend`
- status: **enabled**
- delivery events configured:
  - `email.sent`
  - `email.delivered`
  - `email.delivery_delayed`
  - `email.complained`
  - `email.bounced`
  - `email.failed`
  - `email.suppressed`

**Staging**
- webhook مستقل ومفعّل.
- تم إثبات signed webhook delivery.
- تم إثبات replay deduplication:
  - replay لم ينشئ event/database row ثانياً.
  - status ظل `DELIVERED`.

### 6.5 نقطة ما زالت تحتاج إثباتاً في Production

حتى لحظة التدقيق، production webhook **ليس لديه event طبيعي مسجل بعد**.

هذا ليس failure: webhook الإنتاجي تم إنشاؤه/تفعيله بعد آخر transactional email فعلي في نافذة التدقيق.

إذن:
- configuration: verified.
- secret: present.
- endpoint: enabled.
- staging E2E: proven.
- **natural production delivery telemetry: pending next real production email.**

هذه أهم نقطة تشغيلية يجب إغلاقها قريباً.

---

## 7. Cloudflare Production — الحالة الفعلية

تم التحقق مباشرة من Cloudflare API.

### 7.1 Zone / DNS

`theblacksheepshop.co.uk`:
- Cloudflare zone: **active**
- storefront ما زال على GitHub Pages.
- root A records تشير إلى GitHub Pages.
- `www` CNAME إلى `mo31d.github.io`.
- `api.theblacksheepshop.co.uk` مرتبط بالـWorker.

لا يوجد Cloudflare Pages project لهذا الموقع، وهذا متسق مع التصميم الحالي: storefront = GitHub Pages، API = Worker.

### 7.2 Production Worker

Worker:
- `black-sheep-commerce-api`

Current deployment:
- Deployment ID: `2e629bc4-99e9-41cf-b15e-0b087ec8a33b`
- Version: `6f7f4cfb-1240-4b05-8d19-b8c2df62c5ac`
- deployed via Wrangler
- 100% traffic

Bindings verified:
- production D1.
- production environment.
- exact allowed storefront origins.
- order sender configuration.
- owner notification address configured.
- rate limiter: 5 requests / 60 seconds.
- Turnstile host/action restrictions.

Secrets present:
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `TURNSTILE_SECRET_KEY`

### 7.3 Staging

يوجد Worker منفصل:
- `black-sheep-commerce-api-staging`

ويستخدم:
- D1 مختلف.
- rate limit مختلف.
- staging environment.
- staging webhook منفصل.

هذا الفصل مهم لأنه يمنع اختبارات E2E من العبث ببيانات العملاء الإنتاجية.

---

## 8. D1 — الحالة الفعلية

Production D1:
- `black-sheep-commerce-prod`
- region: `WEUR`
- 13 application tables وفق metadata الحالية، بالإضافة إلى internal SQLite objects.

Migration ledger تم التحقق منه:

1. `0000_initial_orders.sql`
2. `0001_admin_email_auth.sql`
3. `0002_order_fulfilment_message.sql`
4. `0003_order_revisions.sql`
5. `0004_revision_fulfilment.sql`
6. `0005_refunds.sql`
7. `0006_customer_review_messages.sql`
8. `0007_email_delivery_webhooks.sql`
9. `0008_concurrency_guards.sql`

الجداول الحالية تشمل:
- `orders`
- `order_items`
- `order_events`
- `order_revisions`
- `order_revision_items`
- `order_adjustments`
- `refunds`
- `customer_review_tokens`
- `order_messages`
- `email_webhook_events`
- `admin_login_codes`
- `admin_sessions`

### الطلبات الإنتاجية الحالية

المراجعة read-only أظهرت:
- **3 production orders**
- الثلاثة الآن `COMPLETED`.
- بينها Collection وDelivery flows.
- عدد الطلبات ظل محفوظاً خلال migrations/deploy.

آخر D1 Time Travel bookmark الذي أعادته Cloudflare لحظة التدقيق:
- `0000002d-00000000-000050f1-aeec66a729fbd9a98c6a71bdca5da9f3`

ملاحظة: handoff وثّق bookmark أقدم بعد release مباشرة. اختلاف bookmark الحالي طبيعي لأن bookmark يتقدم مع تغييرات قاعدة البيانات؛ يجب أخذ bookmark جديد قبل أي mutation كبيرة مستقبلاً.

---

## 9. Production source vs GitHub HEAD

Production نُشر من source SHA مثبت ومراجع:

- `8c5462388648235acd3a41b853d1adee057a11a7`

بعده وصل `main` إلى:
- `1ea259314b9fd58a66fa69363e20fc14b7792db2`

المقارنة بينهما = **50 commits**.

الأهم: الملفات المختلفة بعد runtime SHA كانت:
- release/health/migration workflows.
- staging webhook E2E script/workflow.
- Admin checklist.
- Session handoff.

**لم توجد تغييرات جديدة في `commerce/src` بين runtime SHA وHEAD المدقق.**

بالتالي عدم نشر آخر 50 commit لا يعني أن Production متأخر عن كود التجارة الحالي؛ هذه الزيادات كانت release tooling / staging test / docs.

---

## 10. المشاكل التي ظهرت أثناء التنفيذ وكيف عولجت

### 10.1 Owner email validation failure — تم الإصلاح

في 24 سبتمبر ظهرت محاولتان من Resend بـHTTP 422 بسبب recipient address غير صالح في إعداد owner notification.

- السبب: قيمة recipient غير صحيحة.
- الأثر: owner notification فشل في تلك المحاولة.
- العلاج: تم تصحيح الإعداد.
- الدليل اللاحق: owner/customer notifications التالية وصلت بنجاح، وجميع الرسائل الـ45 المسجلة في نافذة metrics وصلت.

لا توجد suppressions حالياً.

### 10.2 Admin generated JavaScript / CSV newline bug — تم الإصلاح

Browser QA كشف syntax problem داخل generated Admin inline JavaScript عند بناء CSV.

تم:
- إصلاح escaping الخاص بالnewline.
- إضافة compile guard للـgenerated Admin script.
- إعادة staging deployment.
- إعادة browser QA.

هذه حالة جيدة من regression-driven hardening: bug ظهر، أصلح، ثم أضيف اختبار لمنع رجوعه.

### 10.3 Immediate post-deploy health anomaly — ليست مشكلة runtime

بعد Production Worker deploy مباشرة، أول health response لم يظهر `webhookConfigured`.

بدلاً من تفعيل webhook عشوائياً:
- تم إيقاف التفعيل.
- تشغيل diagnosis workflow.
- التحقق من custom domain وworkers.dev.
- التأكد أن secret binding موجود.
- health recheck نجح وأظهر `webhookConfigured=true`.
- Admin أصبح reachable.
- بعدها تم تفعيل production webhook.

النتيجة المسجلة: propagation/timing effect وليس loss للـsecret أو خطأ routing.

### 10.4 Documentation drift — ما زال يحتاج تنظيف

بعض checklists التاريخية ما زالت تحتوي بنوداً غير محدّثة أو متناقضة مع الواقع الحالي.

أمثلة:
- Commerce checklist ما زال يحتوي بنوداً تشير إلى أن production order النهائي لم يكتمل، بينما D1 الحالي يظهره `COMPLETED`.
- بنود قديمة تشير إلى أن production Admin لم ينشر، بينما Worker الحالي وSession Handoff يؤكدان أنه live.
- بعض البنود تقول "confirm production webhook secret" رغم أن Cloudflare الحالي يؤكد وجوده.
- بعض security verification البنود ما زالت unchecked رغم أن الكود الحالي يطبق hashing/expiry فعلياً.

**التوصية:** لا تستخدم checkbox count وحده لتحديد readiness.  
`docs/ADMIN-V2-CHECKLIST.md` + `docs/SESSION-HANDOFF.md` + live Cloudflare/Resend هي المراجع الأحدث، ثم ينبغي reconcile الملفات التاريخية لاحقاً.

---

## 11. تقييم الصورة الحالية للمتجر والـAdmin

### أمور أصبحت مثبتة فعلياً

- static SEO/product architecture.
- 146-product current catalogue.
- basket/checkout.
- production order persistence.
- Turnstile.
- idempotency.
- staging/production separation.
- owner Admin.
- OTP/session security.
- revision workflow.
- substitutions/reductions/removals/additions.
- delivery/collection revision support.
- secure customer review.
- payment-request communication.
- lifecycle messages.
- manual refund ledger.
- advanced reports.
- signed email telemetry architecture.
- concurrency guards.
- deployment/migration runbooks.
- production Worker + D1 live.
- Resend domain verified.
- DMARC present.

### أمور ما زالت تحتاج تحققاً بشرياً/تشغيلياً

1. فتح Production `/admin` فعلياً على iPhone وdesktop ومراجعة UX بعين المستخدم.
2. fresh production OTP login بعد release.
3. next natural production email للتأكد أن production webhook يسجل `SENT/DELIVERED` داخل D1/Admin.
4. اختبار real production refund ledger فقط عند وجود refund مالي حقيقي.
5. مراجعة lifecycle email matrix، خصوصاً Preparing / Shipped / Cancelled / availability-update على أجهزة البريد الحقيقية.
6. مراجعة focus/keyboard behaviour للـAdmin custom sheets/mobile interactions.
7. reconcile checklists القديمة وإزالة تناقضات الـrelease history.

---

## 12. نقاط لتحويل النظام من جيد تقنياً إلى أكثر احترافية تشغيلياً

### 12.1 Cloudflare Worker observability

الـWorker الحالي لا يظهر عليه `logpush` مفعّل في metadata التي تمت قراءتها.

يوصى بإضافة observability مدروس:
- structured logs.
- error rate.
- request latency.
- webhook failures.
- D1 errors.
- admin auth failures.

مع redaction للـPII وعدم تسجيل customer payloads بلا داع.

### 12.2 Admin code maintainability

`commerce/src/admin/ui.ts` يعمل، لكنه أصبح dense generated inline HTML/JavaScript ويعتمد كثيراً على string templates و`innerHTML`.

لا يحتاج إعادة كتابة فورية، لكن قبل توسعات كبيرة يفضل:
- تقسيم UI إلى وحدات أصغر.
- فصل reports / orders / revision / refund views.
- focus trapping للـsheets/dialogs.
- keyboard accessibility.
- automated accessibility smoke checks.
- الاستمرار في escaping لكل customer-derived text.

### 12.3 Order revisions file

`commerce/src/data/order-revisions.ts` تجاوز 1,700 سطر تقريباً.

مع استمرار التوسع، الأفضل تقسيمه إلى:
- revision repository.
- item mutations.
- adjustments.
- transitions.
- fulfilment.
- snapshot/read model.

هذا يقلل خطر regression عند إضافة inventory أو payment integrations لاحقاً.

### 12.4 Workflow cleanup

يوجد حالياً 17 GitHub workflow file، بينها release-only diagnostic/migration/deploy workflows.

بعد تثبيت release:
- احتفظ بالـCI والdeploy workflows الدائمة.
- archive/remove one-off release workflows فقط بعد توثيق دورها.
- لا تحذف migration history.

### 12.5 DMARC

DNS الحالي:
`v=DMARC1; p=none; pct=100; adkim=r; aspf=r`

هذا صحيح كمرحلة monitoring لكنه لا يفرض quarantine/reject.

بعد فترة مراقبة كافية والتأكد من كل مصادر الإرسال الشرعية:
1. دراسة `p=quarantine`.
2. ثم `p=reject` إذا لم توجد مصادر غير مصرح بها.

لا ينبغي تشديده قبل التأكد من alignment لكل خدمات البريد المستخدمة.

### 12.6 Branch protection

Baseline سابق سجّل أن `main` غير محمي.  
موصل GitHub الحالي أعاد 403 عند محاولة قراءة branch-protection endpoint بسبب صلاحية الـintegration، لذلك **لا يمكن تأكيد الحالة الحالية من هذه المراجعة**.

يجب فحص GitHub Settings يدوياً أو باستخدام token يملك administration read:
- require PR/checks قبل merge.
- prevent force pushes.
- protect release source.

---

## 13. ما لم يتم بناؤه بعد — Future Full Ecommerce

هذه ليست أخطاء في Commerce V1، بل قدرات مرحلة لاحقة:

- automatic inventory.
- inventory reservation.
- integrated payment gateway.
- Apple Pay / Google Pay.
- verified payment webhooks.
- automatic shipping rates.
- label generation.
- automatic tracking updates.
- customer accounts / order history.
- automated refunds.
- discounts/promotions.
- CMS/product admin.
- abandoned-cart workflow.
- tax/VAT automation عند الحاجة.

الهيكل الحالي صُمم بحيث يمكن إضافة هذه القدرات دون إلغاء basket/order model الموجود.

---

## 14. الأولويات المقترحة بعد هذا التقرير

### الأولوية المباشرة — بدون migration أو redeploy

1. **Production Admin real-device QA**
   - iPhone.
   - desktop.
   - revision/substitution/delivery screens.

2. **Fresh production OTP**
   - login.
   - session.
   - logout/expiry basics.

3. **Production webhook natural proof**
   - انتظر/نفّذ transactional email حقيقي ومشروع.
   - تحقق من Resend event.
   - تحقق من D1 `email_webhook_events`.
   - تحقق من Admin communication status.

4. **Lifecycle email matrix**
   - order received.
   - reviewed/availability update.
   - payment reminder/request.
   - payment received.
   - preparing.
   - shipped/ready.
   - cancellation.
   - refund.

5. **Documentation reconciliation**
   - Admin V2 checklist.
   - Commerce checklist.
   - Session handoff.
   - إزالة البنود التي أصبحت stale.

### Hardening بعد ذلك

6. Worker observability.
7. Admin accessibility/interaction polish.
8. workflow cleanup.
9. DMARC enforcement roadmap.
10. branch protection verification.

---

## 15. Release guardrails

حتى توجد نية واضحة لإصدار runtime جديد:

- **لا تعِد تشغيل migrations `0003–0008`.**
- **لا تعِد deploy لنفس runtime SHA لمجرد أن HEAD أحدث.**
- لا تغير Production D1 أثناء QA read-only.
- لا تجعل email هو source of truth للطلب.
- لا تسجل card/banking credentials.
- لا تعرض refund اليدوي كأنه حركة مالية أوتوماتيكية.
- احتفظ بالفصل بين staging وproduction.
- خذ D1 Time Travel bookmark حديث قبل أي mutation كبيرة مستقبلية.

---

## 16. الاستنتاج

خلال يومين، Black Sheep انتقل من مشروع storefront/كتالوج متطور إلى **منظومة تجارة تشغيلية حقيقية ذات Backend وAdmin وDatabase وEmail lifecycle وCustomer Review وRefund/Reports layer**.

أهم تغيير جذري ليس في الشكل؛ بل في **مصدر الحقيقة وسير العمل**:

- الطلب أصبح record في D1 وليس رسالة email فقط.
- السعر والتحقق أصبحا server-authoritative.
- صاحب المتجر يستطيع تعديل الطلب مع الاحتفاظ بالأصل.
- العميل يستطيع مراجعة النسخة المعدلة بأمان.
- كل خطوة مهمة لها audit trail.
- email أصبح channel للتواصل وليس database.
- staging وproduction منفصلان.
- release أصبح migration/deploy/health-gated.

الحالة الحالية مناسبة للانتقال إلى **post-release validation/polish** وليس لبناء Commerce من الصفر من جديد.

أهم gap واحد يجب إغلاقه قريباً هو **إثبات production email delivery telemetry بأول transactional email طبيعي بعد تفعيل webhook**، ثم مراجعة الـAdmin على أجهزة حقيقية وتنظيف documentation/workflows.

---

## Appendix A — Current production anchors

| العنصر | القيمة |
|---|---|
| Audited GitHub HEAD | `1ea259314b9fd58a66fa69363e20fc14b7792db2` |
| Production runtime source | `8c5462388648235acd3a41b853d1adee057a11a7` |
| Worker | `black-sheep-commerce-api` |
| Worker deployment | `2e629bc4-99e9-41cf-b15e-0b087ec8a33b` |
| Worker version | `6f7f4cfb-1240-4b05-8d19-b8c2df62c5ac` |
| Production D1 | `black-sheep-commerce-prod` |
| D1 migration level | `0000–0008` |
| Production order count at audit | 3 |
| Production webhook | enabled |
| Resend domain | verified |
| DMARC | `p=none; pct=100; adkim=r; aspf=r` |

## Appendix B — Current relevant engineering footprint

Current repository tree includes:
- 77 files under `commerce/`.
- 17 GitHub workflow files.
- 9 D1 migration files (`0000`–`0008`).
- dedicated tests for:
  - orders
  - pricing
  - Turnstile
  - admin
  - revisions
  - customer review
  - refunds
  - Resend
  - webhooks
  - concurrency
  - status/payment notifications.

## Appendix C — Data interpretation notes

- GitHub compare responses cap the returned file list; therefore the 300-file / line-change aggregate should be read as the returned comparison set, not necessarily the full theoretical file count.
- Resend 100% delivery reflects only 45 messages during this short audit window, many of which are controlled testing/validation traffic.
- Production webhook having zero events at audit time is expected because it was enabled after the most recent transactional sends.
- No secret values are included in this report.
