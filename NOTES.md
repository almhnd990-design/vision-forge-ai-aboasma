# NOTES — GhostOps AI: التحول من Demo إلى MVP تجاري

**التاريخ:** 2026-09-13
**الفرع:** `ghostops-commercial-mvp`
**آخر commit مرفوع:** `7d56c0d3` (يحتاج تحديثًا — انظر "الخطوة الجاية")
**مجلد العمل:** `C:\Users\ASUS\Documents\Desktop\ghostops-work`
**المشروع الأصلي (لم يُلمس):** `C:\Users\ASUS\Documents\Desktop\client-project` — 30/30 ملفًا مطابق للأصل بـ SHA-256

> **قرار توقف:** تم إيقاف محاولات `next build` نهائيًا بناءً على طلب صاحب المشروع، لأن البيئة (Sandbox) تمنع `spawn` الذي يستخدمه Next عبر `jest-worker`، ولأنه يستهلك وقتًا طويلًا. آخر حالة بناء موثّقة كانت **ناجحة** ومُسجّلة أدناه.

---

## (أ) ملخص ما تم إنجازه

### 1. تشخيص بيئي مهم (موثّق حتى لا يُكتشف مرتين)
- `git` **غير مثبّت** على الجهاز ⇒ كل عمليات GitHub تمت عبر **GitHub REST API** بـ Node، والنتيجة commit حقيقي مطابق تمامًا لـ `git push`.
- `next build` يفشل بـ `spawn EPERM` لأن Next يوزّع البناء على عمليات فرعية (`jest-worker`). جُرِّب `experimental.workerThreads` فتجاوز الترجمة لكنه اصطدم بـ `DataCloneError` من Next نفسه ⇒ أُبقي مسار البناء القياسي.
- `npm ci` يحتاج `--ignore-scripts` (سكربت `unrs-resolver` postinstall لا يستطيع spawn). الحزم الأصلية المهمة (`@next/swc-win32-x64-msvc`) تأتي كـ optional dependencies ولا تتأثر.
- `curl` يفشل (`SEC_E_NO_CREDENTIALS`) ⇒ كل الاتصالات عبر `node:fetch`.

### 2. الطبقات المبنية (كلها جديدة، والهوية البصرية لم تُمس)
| الطبقة | الملفات | الحالة |
|---|---|---|
| تهيئة الأسعار والمزايا المركزية | `lib/plans.ts` | ✅ SAR 99/299/799 كهلالات صحيحة، سجل ميزات `live/beta/planned`، جاهز للسنوي |
| عقد المتغيرات البيئية | `lib/env-contract.ts`, `lib/config.ts` | ✅ كل قدرة تعلن عن نفسها + المتغيرات الناقصة بالاسم |
| أساسيات اللغة (بلا اعتماد دائري) | `lib/locale.ts` | ✅ |
| قاعدة البيانات + عزل المستأجرين | `supabase/migrations/20260913000100_core_schema.sql` و `...000200_rls.sql` | ✅ 13 جدولًا، دالة `is_workspace_owner`، **trigger يمنع المتصفح من كتابة أعمدة الفوترة**، وجداول مغلقة تمامًا (أسرار الموصلات، الاستخدام، أحداث الدفع) |
| أنواع الصفوف | `lib/db/types.ts` | ✅ |
| الوصول + فرض الحصص | `lib/db/access.ts` | ✅ على الخادم: تحليل/مساحات/موصلات |
| عملاء Supabase | `lib/db/browser.ts`, `lib/db/server.ts` | ✅ متصفح / جلسة الطلب (RLS) / service role |
| طبقة AI | `lib/ai/reason.ts` | ✅ مزوّد مجرّد (OpenAI/DeepSeek)، **يرفض أي معرّف نتيجة غير موجود**، ولا يختلق رقمًا |
| محرك حتمي بمعرّفات مستقرة | `lib/agent/engine.ts` | ✅ `analyze.ts` الأصلي لم يُعدَّل |
| خدمة التحليل + آلة الحالات | `lib/agent/service.ts` | ✅ detected→reviewed→approved→executing→completed |
| الفوترة | `lib/billing/{stripe,apply,public-state}.ts` | ✅ تحقق توقيع Webhook، **idempotency**، `past_due` فوري، بوابة فوترة |
| الموصلات | `lib/connectors/{types,registry,crypto,secrets,stripe-connector,service}.ts` | ✅ موصل Stripe قراءة-فقط، تشفير **AES-256-GCM**، باقي المزوّدين `planned` |
| مسارات API | `app/api/{analysis,findings,connections,billing}/**` | ✅ **المصادقة قبل التحقق من المدخلات** في كل مسار |
| المصادقة | `lib/auth/{client,server}.ts`, `app/[locale]/{sign-in,sign-up,auth/callback}` | ✅ تحقق آمن من مسارات التحويل، وصف أخطاء مترجم |
| Onboarding | `app/[locale]/onboarding`, `components/onboarding-form.tsx` | ✅ 4 خطوات قصيرة |
| الإعدادات | `app/[locale]/settings`, `components/settings-client.tsx` | ✅ ملف/مساحة/لغة/اشتراك/اتصالات/تصدير/حذف |
| صفحة الاتصالات | `app/[locale]/connections`, `components/connections-client.tsx` | ✅ ربط/فصل/مزامنة + "قريبًا" بلا زر وهمي |
| الواجهة التسويقية | `components/pricing.tsx`, `app/[locale]/pricing` | ✅ EN/AR + FAQ + حالة تهيئة صريحة |
| الصفحات القانونية | `lib/legal/content.ts`, `app/[locale]/legal/[doc]` | ✅ 5 مستندات × لغتين بلا أي ادعاء امتثال |
| SEO + OG + hreflang | `app/layout.tsx` + `generateMetadata` لكل صفحة | ✅ |
| لافتة صراحة التخزين | `components/auth-banner.tsx` | ✅ الداشبورد يعلن أنه يعمل في المتصفح فقط |

### 3. الأمان — عيب حقيقي اكتُشف وأُصلح
مسارات API كانت تتحقق من **المدخلات قبل المصادقة**، ما يسمح لمهاجم مجهول باستكشاف عقد الـAPI. الآن المصادقة أولًا في: تحليل، قرارات، اتصالات، مزامنة، checkout، portal.

### 4. نتائج الاختبار (آخر تشغيل ناجح — موثّق)
```
typecheck         → 0 أخطاء
lint              → 0 أخطاء، 0 تحذيرات
build             → نجح (17 مسارًا + 10 صفحات قانونية مُسبقة التوليد)
test:unit         → 118/118 ✅
test:production   → 24/24  ✅
test:commercial   → 90/90  ✅ (فحص واحد متخطّى، موضّح أدناه)
─────────────────────────────
الإجمالي          → 232 فحصًا
```

### 5. ما لم يُختبر (بصراحة تامة)
- **الفوترة E2E:** ❌ لا يوجد حساب Stripe. المُختبر فقط مسارات **الرفض** (503/400 للمجهول وللتوقيع المزوّر).
- **المصادقة وRLS وعزل المستأجرين:** ❌ لا يوجد مشروع Supabase. ملفات SQL مكتوبة ومراجَعة، **لم تُنفَّذ**.
- **AI E2E:** ❌ لا يوجد مفتاح. المُختبر فقط حالة عدم التهيئة + رفض الاختلاق + اختيار المزوّد.
- **موصل Stripe بمفتاح حقيقي:** ❌ المُختبر فقط مواصفته وأعلامه.
- **قائمة المزوّدين في صفحة الاتصالات:** متخطّاة — تتطلب حسابًا مسجّلًا.
- **أي اختبار واجهة بالمتصفح:** غير موجود.

### 6. الحكم النهائي
🟡 **Demo ready** — وليس Private beta (المصادقة تحتاج مشروع Supabase) ولا Commercial launch.
**معرّفات الإطلاق المانعة:** Supabase (3 متغيرات) + Stripe (5 متغيرات) + `CONNECTOR_ENCRYPTION_KEY`.
للفحص الفوري: `npm run check:env` (يطبع حالة كل قدرة بنفسه).

---

## (ب) الملفات المعدَّلة والمضافة

### ملفات أُضيفت (جديدة بالكامل)
```
lib/plans.ts                      lib/locale.ts                 lib/config.ts
lib/env-contract.ts               lib/pricing-format.ts         lib/workspace-service.ts
lib/i18n/labels.ts                lib/db/types.ts               lib/db/access.ts
lib/db/browser.ts                 lib/db/server.ts              lib/ai/reason.ts
lib/agent/engine.ts               lib/agent/service.ts          lib/auth/client.ts
lib/auth/server.ts                lib/api/guard.ts              lib/billing/stripe.ts
lib/billing/apply.ts              lib/billing/public-state.ts   lib/connectors/types.ts
lib/connectors/registry.ts        lib/connectors/crypto.ts      lib/connectors/secrets.ts
lib/connectors/stripe-connector.ts lib/connectors/service.ts    lib/legal/content.ts
lib/actions/workspace.ts          lib/actions/account.ts
components/pricing.tsx            components/auth-form.tsx      components/onboarding-form.tsx
components/settings-client.tsx    components/connections-client.tsx
components/config-notice.tsx      components/auth-banner.tsx
app/commercial.css                next.config.mjs               docs/BUILD-STATE.md
scripts/verify-commercial.mjs     scripts/verify-commercial-e2e.mjs
scripts/check-env.mjs             scripts/alias-register.mjs    scripts/alias-loader-hooks.mjs
supabase/migrations/20260913000100_core_schema.sql
supabase/migrations/20260913000200_rls.sql
app/[locale]/pricing/page.tsx     app/[locale]/sign-in/page.tsx  app/[locale]/sign-up/page.tsx
app/[locale]/onboarding/page.tsx  app/[locale]/settings/page.tsx app/[locale]/connections/page.tsx
app/[locale]/legal/[doc]/page.tsx app/[locale]/auth/callback/route.ts
app/api/analysis/run/route.ts     app/api/findings/decide/route.ts
app/api/connections/route.ts      app/api/connections/sync/route.ts
app/api/billing/checkout/route.ts app/api/billing/portal/route.ts
app/api/billing/webhook/route.ts
```

### ملفات موجودة عُدِّلت (بحدود ضيقة ومقصودة)
| الملف | التعديل |
|---|---|
| `package.json` | إضافة `stripe`، وسكربتات `test:unit` / `test:commercial` / `test:all` / `check:env` |
| `app/layout.tsx` | metadata موسّع (OG/Twitter/hreflang/canonical) + استيراد `commercial.css` |
| `app/[locale]/page.tsx` | تمرير حالة الفوترة (server-side) إلى صفحة الهبوط |
| `components/landing.tsx` | إضافة قسم الأسعار + رابط "الأسعار" في التنقل |
| `components/dashboard.tsx` | إضافة `cloud` prop + لافتة التخزين المحلي + روابط للاتصالات والإعدادات + تحويل أيقونة المستخدم إلى رابط |
| `app/[locale]/dashboard/page.tsx` | تمرير حالة الحساب/السحابة + `noindex` |
| `lib/i18n/dictionaries.ts` | إضافة قاموس `pricing` كامل بالإنجليزية والعربية |
| `lib/workspace.ts` | إضافة `INSIGHT_LIMITS` (لم يُغيَّر أي منطق قائم) |
| `.env.example` | إعادة كتابة موثّقة لكل القدرات ومتطلباتها |
| `docs/BUILD-STATE.md` | تحديث حالة البناء والاختبارات |

### ملفات لم تُمس إطلاقًا (مهم)
- `lib/agent/analyze.ts` — محرك التحليل الحتمي، **صفر تغيير**.
- جميع ملفات `client-project` (المشروع الأصلي) — **صفر تغيير**.

---

## (ج) الخطوة الجاية

### أولًا: حفظ العمل على GitHub (لم يُرفع بعد)
آخر commit مرفوع هو `7d56c0d3`، وكل ما بعد ذلك (المصادقة، Onboarding، الإعدادات، الاتصالات، توسعة الاختبارات) **محلي فقط**.
- الأداة: `C:\Users\ASUS\Documents\Desktop\_dsh_tmp\push-mvp.mjs` (تستخدم `GH_TOKEN` + `COMMIT_MESSAGE`).
- بعد الرفع: تشغيل `verify-mvp-branch.mjs` للتأكد أن الملفات مطابقة بايت-ببايت.
- **تنبيه أمني:** توكن GitHub المستخدم ما زال مكشوفًا في هذه المحادثة ⇒ **أبطله (revoke) بعد الرفع**.

### ثانيًا: لتفعيل المنتج فعليًا (بالترتيب)
1. **إنشاء مشروع Supabase** ثم تنفيذ الملفين في `supabase/migrations/` بالترتيب.
2. ضبط `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. اختبار المصادقة + **إثبات عزل المستأجرين**: حسابان، ومحاولة قراءة مساحة الآخر (يجب أن ترجع "غير موجود").
4. **Stripe (وضع الاختبار):** إنشاء 3 أسعار (99/299/799 ريال شهريًا) وضبط `STRIPE_SECRET_KEY` و `STRIPE_WEBHOOK_SECRET` و `STRIPE_PRICE_*`.
5. تنفيذ دفع تجريبي كامل + التحقق من وصول Webhook وتحديث `billing_status` وفرض الحصة.
6. توليد `CONNECTOR_ENCRYPTION_KEY` (32 بايت) ثم ربط Stripe بمفتاح **مقيّد للقراءة فقط** وتشغيل مزامنة حقيقية.
7. إضافة `OPENAI_API_KEY` أو `DEEPSEEK_API_KEY` واختبار طبقة الاستدلال.
8. تشغيل `npm run check:env` قبل وبعد كل خطوة.

### ثالثًا: عمل هندسي متبقٍّ
- استبدال الاعتماد على `localStorage` في الداشبورد ببيانات الخادم عند تهيئة الحسابات (المسارات جاهزة).
- نظام جدولة الفحوصات الخلفية (الجدول موجود في المخطط، ولا مجدول يعمل).
- مقاعد الفريق (مُعلنة `planned`).
- ربط PR رسمي: الفرع `ghostops-commercial-mvp` → `main` (الـ README يطلب PR لا نشرًا مباشرًا).
- مراجعة قانونية للصفحات (كلها موسومة كمسودات).

### رابعًا: قيود يجب تذكّرها
- **لا تشغّل `next build`** في هذه البيئة إلا بصلاحية كاملة؛ وإلا يفشل بـ `spawn EPERM` (السبب موثّق أعلى الملف).
- استخدم `npm ci --ignore-scripts` في البيئات المقيّدة.
- `git` غير مثبّت ⇒ استخدم سكربتات `_dsh_tmp/push-mvp.mjs`.

---

## حالة الملفات المؤقتة
- `C:\Users\ASUS\Documents\Desktop\_dsh_tmp\` — سكربتات مساعدة (فك الضغط، الرفع، الفحص، مُحمِّل الاختبارات). يمكن حذفها بعد الرفع.
- `C:\Users\ASUS\Documents\Desktop\client-project-report.md` و `integrations-audit.md` — تقارير المرحلة السابقة.
