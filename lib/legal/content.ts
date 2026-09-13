import type { Locale } from "@/lib/locale";

/**
 * Legal and trust pages.
 *
 * These are LAUNCH-READY STRUCTURE, not legal advice, and they deliberately make no
 * compliance claims (no "SOC 2", no "GDPR certified", no "ISO 27001"). Every factual
 * statement below describes what the software actually does today. A qualified adviser
 * must review and complete them before commercial launch, and the pages say so.
 */

export type LegalDocKey = "privacy" | "terms" | "refunds" | "security" | "contact";

export const LEGAL_DOC_KEYS: LegalDocKey[] = [
  "privacy",
  "terms",
  "refunds",
  "security",
  "contact",
];

export type LegalSection = { heading: string; body: string[]; list?: string[] };
export type LegalDoc = { title: string; updated: string; draftNotice: string; sections: LegalSection[] };

const UPDATED = "2026-09-13";

const en: Record<LegalDocKey, LegalDoc> = {
  privacy: {
    title: "Privacy Policy",
    updated: UPDATED,
    draftNotice:
      "This policy is a launch draft. It describes what the software actually does today and contains no compliance certification claims. It must be reviewed by a qualified legal adviser before commercial launch.",
    sections: [
      {
        heading: "What we store",
        body: [
          "When you create an account we store your email address, an optional display name, your interface language, and the workspaces you create.",
          "For each analysis we store the business snapshot you entered or imported, the findings produced by the analysis engine, your review decisions, and an audit record of who changed what and when.",
          "If you connect a payments provider, we store the account identifier the provider returns, the permissions granted, sync timestamps, and any error message. Provider credentials are encrypted before storage.",
        ],
      },
      {
        heading: "What we do not store",
        body: [
          "We do not store card numbers or bank details. Payments are handled entirely by Stripe on their own infrastructure and we only ever see a customer identifier, a subscription identifier and a status.",
          "We do not store passwords: authentication is delegated to Supabase Auth.",
          "We do not sell customer data and we do not use it to train models.",
        ],
      },
      {
        heading: "Who can see your data",
        body: [
          "Your workspace is isolated at the database level with row level security. Another customer cannot read your workspace, your snapshots, your findings, or your subscription, even if they know the identifier.",
          "Within our own operations, only the technical staff who must resolve a support request you raised can access that workspace, using server-side tooling.",
        ],
      },
      {
        heading: "Third parties that process data",
        body: [
          "Supabase hosts authentication and the database.",
          "Stripe processes payments and subscription state.",
          "If you enable AI reasoning, the deterministic findings and the numbers in your snapshot are sent to the configured model provider (OpenAI or DeepSeek) to produce an explanation. Provider credentials are never sent.",
          "If you connect a provider, we read only the data described on the Connections screen.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can export your workspace data as JSON at any time from account settings.",
          "You can delete your account and its data from account settings. Deletion removes your workspaces, snapshots, findings, reviews, audit records and connection metadata.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: UPDATED,
    draftNotice:
      "These terms are a launch draft and are not legal advice. They make no compliance certification claims and must be reviewed by a qualified legal adviser before commercial launch.",
    sections: [
      {
        heading: "What GhostOps is",
        body: [
          "GhostOps AI is a subscription analysis tool for business operators. It reads business data you provide or authorise, runs a deterministic analysis engine, optionally adds an AI-written explanation on top of that analysis, and presents findings with their evidence.",
        ],
      },
      {
        heading: "What GhostOps is not",
        body: [
          "GhostOps is not a payment processor, a bank, an accountant, or a financial adviser.",
          "GhostOps does not move money and does not act on your behalf. A finding is a prompt to investigate, not an instruction and not a guarantee that money is recoverable.",
          "GhostOps does not provide continuous monitoring. Analyses run when you start them.",
        ],
        list: [
          "No automated refunds, charges or provider changes are performed by this software.",
          "Approving a finding records your decision. It does not execute anything.",
          "Findings reflect the data supplied. Incomplete data produces incomplete findings.",
        ],
      },
      {
        heading: "Your responsibilities",
        body: [
          "You must have the right to access any data you connect or upload.",
          "You must not upload credentials, card numbers, or personal data of your customers beyond what the analysis requires.",
          "You are responsible for your own subscription: keeping payment details valid and cancelling if you no longer want the service.",
        ],
      },
      {
        heading: "Subscriptions and pricing",
        body: [
          "Plans are billed monthly in Saudi Riyal through Stripe. The price you pay is the price shown on the pricing page at the time you subscribe.",
          "Trials convert to paid subscriptions unless cancelled before they end. You can cancel at any time from the billing portal in account settings.",
          "If a payment fails, paid features pause until the payment succeeds. Your data is not deleted.",
        ],
      },
      {
        heading: "Availability and liability",
        body: [
          "The service is provided as-is. We do not warrant uninterrupted availability, and third-party providers can fail independently of us.",
          "To the extent permitted by law, our liability is limited to the amount you paid in the twelve months before a claim.",
        ],
      },
    ],
  },
  refunds: {
    title: "Refunds & Cancellation",
    updated: UPDATED,
    draftNotice:
      "This policy is a launch draft. It must be reviewed by a qualified legal adviser, and the final wording depends on the billing configuration actually enabled at launch.",
    sections: [
      {
        heading: "Cancelling",
        body: [
          "You can cancel at any time from the billing portal in account settings. Cancellation takes effect at the end of the period you have already paid for, and you keep access until then.",
          "We do not require an email or a phone call to cancel.",
        ],
      },
      {
        heading: "Free trials",
        body: [
          "Trials are defined per plan. If you cancel before the trial ends you are not charged.",
          "If you do not cancel, the trial converts to the paid subscription you selected.",
        ],
      },
      {
        heading: "Refund eligibility",
        body: [
          "If you were charged after cancelling, or charged twice, contact support and we will refund it in full.",
          "If the service was unavailable for a sustained period in a billing month, contact support within that month and we will assess a pro-rata credit.",
          "Partial months that you chose to stop using are not automatically refunded, because the workspace and its history remain available until the period ends.",
        ],
      },
      {
        heading: "Failed payments",
        body: [
          "We do not delete data because a payment failed. Access to paid features pauses until the payment succeeds, and resumes automatically after it does.",
        ],
      },
      {
        heading: "How to request a refund",
        body: [
          "Use the support channel on the contact page with your workspace name and the invoice identifier from Stripe. We aim to respond within two business days.",
        ],
      },
    ],
  },
  security: {
    title: "Security & Data Processing",
    updated: UPDATED,
    draftNotice:
      "This page describes implemented technical controls only. It makes no certification or audit claims, because no certification or audit has been performed.",
    sections: [
      {
        heading: "Tenant isolation",
        body: [
          "Every tenant-owned row carries a workspace identifier and is protected by PostgreSQL row level security. A customer's session can only read rows belonging to their own workspace.",
          "Operations that affect money, plan entitlements or finding state are performed by trusted server code after ownership is verified, so they cannot be triggered from a browser session.",
        ],
      },
      {
        heading: "Credential handling",
        body: [
          "Provider credentials are encrypted with AES-256-GCM before they are stored, in a separate table that has no client-accessible policy at all.",
          "Credential values are never returned to the browser, never written to logs, and never included in error responses.",
        ],
      },
      {
        heading: "Payments",
        body: [
          "Card data never reaches our servers. Stripe hosts the checkout form and the billing portal.",
          "Every webhook is verified against the signing secret before its contents are trusted, and each provider event is applied at most once so a retried delivery cannot duplicate a subscription change.",
        ],
      },
      {
        heading: "Application controls",
        body: [
          "API inputs are validated with a schema before use. Plan limits and feature entitlements are enforced on the server, not only hidden in the interface.",
          "Secrets are read from environment variables on the server. The service role key is never exposed to the browser bundle.",
        ],
      },
      {
        heading: "What is not claimed",
        body: [
          "We hold no SOC 2, ISO 27001, or similar certification, and we do not claim PCI DSS compliance of our own systems; card processing is delegated to Stripe.",
          "No independent penetration test has been performed on this application.",
        ],
      },
    ],
  },
  contact: {
    title: "Contact & Support",
    updated: UPDATED,
    draftNotice:
      "The support channel below must be replaced with a monitored mailbox before commercial launch. A placeholder address would silently lose customer requests.",
    sections: [
      {
        heading: "Support",
        body: [
          "Support is handled over email. Include your workspace name and, for billing questions, the Stripe invoice identifier.",
          "The monitored support address is configured by the operator of this deployment and is not hard-coded in the product.",
        ],
      },
      {
        heading: "Response expectations",
        body: [
          "Standard plans receive email support. Higher plans are routed with a priority flag. These are response targets, not contractual service levels.",
        ],
      },
      {
        heading: "Security reports",
        body: [
          "If you believe you have found a security issue, report it privately rather than publicly, and include the steps needed to reproduce it. Do not access data that is not yours while investigating.",
        ],
      },
    ],
  },
};

const ar: Record<LegalDocKey, LegalDoc> = {
  privacy: {
    title: "سياسة الخصوصية",
    updated: UPDATED,
    draftNotice:
      "هذه السياسة مسودة إطلاق. تصف ما يفعله البرنامج فعليًا اليوم، ولا تتضمن أي ادعاء بشهادات امتثال. يجب أن يراجعها مستشار قانوني مؤهل قبل الإطلاق التجاري.",
    sections: [
      {
        heading: "ما نخزّنه",
        body: [
          "عند إنشاء حساب نخزّن بريدك الإلكتروني، واسمًا اختياريًا للعرض، ولغة الواجهة، ومساحات العمل التي تنشئها.",
          "لكل تحليل نخزّن لقطة الأعمال التي أدخلتها أو استوردتها، والنتائج التي أنتجها محرك التحليل، وقرارات المراجعة، وسجل تدقيق يوضح من غيّر ماذا ومتى.",
          "إذا ربطت مزوّد مدفوعات، نخزّن معرّف الحساب الذي يعيده المزوّد، والصلاحيات الممنوحة، وأوقات المزامنة، ورسالة الخطأ إن وُجدت. وتُشفَّر بيانات الاعتماد قبل تخزينها.",
        ],
      },
      {
        heading: "ما لا نخزّنه",
        body: [
          "لا نخزّن أرقام البطاقات أو البيانات البنكية. تُعالَج المدفوعات بالكامل عبر Stripe على بنيته التحتية، ولا نرى سوى معرّف العميل ومعرّف الاشتراك والحالة.",
          "لا نخزّن كلمات المرور: تُدار المصادقة عبر Supabase Auth.",
          "لا نبيع بيانات العملاء ولا نستخدمها لتدريب النماذج.",
        ],
      },
      {
        heading: "من يمكنه رؤية بياناتك",
        body: [
          "مساحة عملك معزولة على مستوى قاعدة البيانات عبر أمان مستوى الصفوف. لا يستطيع عميل آخر قراءة مساحتك أو لقطاتك أو نتائجك أو اشتراكك حتى لو عرف المعرّف.",
          "داخل فريقنا، لا يصل إلى مساحة العمل إلا الموظفون التقنيون الذين يلزمهم حلّ طلب دعم رفعته أنت، وبأدوات من جهة الخادم.",
        ],
      },
      {
        heading: "أطراف ثالثة تعالج البيانات",
        body: [
          "Supabase تستضيف المصادقة وقاعدة البيانات.",
          "Stripe تعالج المدفوعات وحالة الاشتراك.",
          "إذا فعّلت الاستدلال بالذكاء الاصطناعي، تُرسل النتائج الحتمية والأرقام الموجودة في لقطتك إلى مزوّد النموذج المهيأ (OpenAI أو DeepSeek) لإنتاج الشرح. ولا تُرسل بيانات الاعتماد إطلاقًا.",
          "إذا ربطت مزوّدًا، نقرأ فقط البيانات الموصوفة في شاشة الربط.",
        ],
      },
      {
        heading: "حقوقك",
        body: [
          "يمكنك تصدير بيانات مساحة عملك بصيغة JSON في أي وقت من إعدادات الحساب.",
          "يمكنك حذف حسابك وبياناته من إعدادات الحساب. الحذف يزيل مساحات العمل واللقطات والنتائج والمراجعات وسجلات التدقيق وبيانات الربط.",
        ],
      },
    ],
  },
  terms: {
    title: "شروط الخدمة",
    updated: UPDATED,
    draftNotice:
      "هذه الشروط مسودة إطلاق وليست استشارة قانونية. لا تتضمن ادعاءات بشهادات امتثال، ويجب أن يراجعها مستشار قانوني مؤهل قبل الإطلاق التجاري.",
    sections: [
      {
        heading: "ما هو GhostOps",
        body: [
          "GhostOps AI أداة تحليل باشتراك لمشغّلي الأعمال. تقرأ بيانات الأعمال التي تقدمها أو تأذن بها، وتشغّل محرك تحليل حتميًا، وتضيف اختياريًا شرحًا مكتوبًا بالذكاء الاصطناعي فوق ذلك التحليل، وتعرض النتائج مع أدلتها.",
        ],
      },
      {
        heading: "ما ليس GhostOps",
        body: [
          "GhostOps ليس معالج مدفوعات ولا بنكًا ولا محاسبًا ولا مستشارًا ماليًا.",
          "GhostOps لا يحرّك الأموال ولا يتصرف نيابة عنك. النتيجة دعوة للتحقق، وليست أمرًا ولا ضمانًا بأن المبلغ قابل للاسترداد.",
          "GhostOps لا يوفّر مراقبة مستمرة. التحليلات تعمل عند تشغيلها من طرفك.",
        ],
        list: [
          "لا ينفّذ هذا البرنامج أي استرداد أو خصم أو تعديل تلقائي لدى المزوّدين.",
          "اعتماد نتيجة يسجّل قرارك ولا ينفّذ شيئًا.",
          "النتائج تعكس البيانات المقدَّمة، والبيانات الناقصة تعطي نتائج ناقصة.",
        ],
      },
      {
        heading: "مسؤولياتك",
        body: [
          "يجب أن تملك حق الوصول إلى أي بيانات تربطها أو ترفعها.",
          "يجب ألّا ترفع بيانات اعتماد أو أرقام بطاقات أو بيانات شخصية لعملائك بما يتجاوز ما يحتاجه التحليل.",
          "أنت مسؤول عن اشتراكك: تحديث بيانات الدفع والإلغاء عند عدم الحاجة.",
        ],
      },
      {
        heading: "الاشتراكات والأسعار",
        body: [
          "تُفوتَر الخطط شهريًا بالريال السعودي عبر Stripe. السعر الذي تدفعه هو السعر المعروض في صفحة الأسعار عند اشتراكك.",
          "تتحول التجربة إلى اشتراك مدفوع ما لم تُلغِ قبل انتهائها. ويمكنك الإلغاء في أي وقت من بوابة الفوترة في إعدادات الحساب.",
          "إذا فشل الدفع، تتوقف المزايا المدفوعة حتى نجاحه، ولا تُحذف بياناتك.",
        ],
      },
      {
        heading: "التوفر والمسؤولية",
        body: [
          "تُقدَّم الخدمة كما هي. لا نضمن توفرًا متواصلًا، وقد تتعطل خدمات الأطراف الثالثة بشكل مستقل عنا.",
          "بالحد الذي يسمح به القانون، تقتصر مسؤوليتنا على المبلغ الذي دفعته خلال الاثني عشر شهرًا السابقة للمطالبة.",
        ],
      },
    ],
  },
  refunds: {
    title: "الاسترداد والإلغاء",
    updated: UPDATED,
    draftNotice:
      "هذه السياسة مسودة إطلاق، ويجب أن يراجعها مستشار قانوني مؤهل. والصياغة النهائية تعتمد على إعداد الفوترة المفعّل فعليًا عند الإطلاق.",
    sections: [
      {
        heading: "الإلغاء",
        body: [
          "يمكنك الإلغاء في أي وقت من بوابة الفوترة في إعدادات الحساب. يسري الإلغاء في نهاية الفترة المدفوعة مسبقًا، ويستمر وصولك حتى ذلك الحين.",
          "لا نطلب بريدًا إلكترونيًا ولا مكالمة للإلغاء.",
        ],
      },
      {
        heading: "التجربة المجانية",
        body: [
          "مدة التجربة محددة لكل خطة. إذا ألغيت قبل انتهائها فلا يُحصَّل منك أي مبلغ.",
          "إذا لم تُلغِ، تتحول التجربة إلى الاشتراك المدفوع الذي اخترته.",
        ],
      },
      {
        heading: "أهلية الاسترداد",
        body: [
          "إذا حُصِّل منك مبلغ بعد الإلغاء، أو حُصِّل مرتين، تواصل مع الدعم وسنعيده بالكامل.",
          "إذا كانت الخدمة متوقفة لفترة ممتدة خلال شهر فوترة، تواصل مع الدعم خلال الشهر نفسه وسنقيّم رصيدًا نسبيًا.",
          "الأشهر الجزئية التي توقفت عن الاستخدام بمحض اختيارك لا تُرد تلقائيًا، لأن مساحة العمل وسجلها يبقيان متاحين حتى نهاية الفترة.",
        ],
      },
      {
        heading: "المدفوعات الفاشلة",
        body: [
          "لا نحذف البيانات بسبب فشل دفع. تتوقف المزايا المدفوعة حتى نجاح الدفع، ثم تستأنف تلقائيًا بعده.",
        ],
      },
      {
        heading: "كيف تطلب استردادًا",
        body: [
          "استخدم قناة الدعم في صفحة التواصل مع اسم مساحة العمل ومعرّف الفاتورة من Stripe. نستهدف الرد خلال يومين عمل.",
        ],
      },
    ],
  },
  security: {
    title: "الأمان ومعالجة البيانات",
    updated: UPDATED,
    draftNotice:
      "تصف هذه الصفحة ضوابط تقنية مُنفَّذة فقط، ولا تتضمن أي ادعاء بشهادة أو تدقيق، لأنه لم يُجرَ أي تدقيق أو شهادة.",
    sections: [
      {
        heading: "عزل المستأجرين",
        body: [
          "كل صف يخص مستأجرًا يحمل معرّف مساحة عمل، ومحمي بأمان مستوى الصفوف في PostgreSQL. جلسة العميل تستطيع قراءة صفوف مساحته فقط.",
          "العمليات التي تمسّ الأموال أو مزايا الخطة أو حالة النتائج تُنفَّذ في كود خادمي موثوق بعد التحقق من الملكية، ولا يمكن تشغيلها من جلسة متصفح.",
        ],
      },
      {
        heading: "التعامل مع بيانات الاعتماد",
        body: [
          "تُشفَّر بيانات اعتماد المزوّدين بـ AES-256-GCM قبل تخزينها، في جدول منفصل بلا أي سياسة وصول للعملاء.",
          "لا تُعاد قيم الاعتماد إلى المتصفح، ولا تُكتب في السجلات، ولا تُضمن في ردود الأخطاء.",
        ],
      },
      {
        heading: "المدفوعات",
        body: [
          "بيانات البطاقة لا تصل إلى خوادمنا. Stripe تستضيف نموذج الدفع وبوابة الفوترة.",
          "يُتحقق من كل Webhook مقابل السرّ الموقِّع قبل الوثوق بمحتواه، ويُطبَّق كل حدث مرة واحدة على الأكثر حتى لا يؤدي تكرار التسليم إلى تكرار تغيير الاشتراك.",
        ],
      },
      {
        heading: "ضوابط التطبيق",
        body: [
          "تُتحقق مدخلات الـ API بمخطط قبل الاستخدام. وتُفرض حدود الخطة والمزايا على الخادم، لا بإخفائها في الواجهة فقط.",
          "تُقرأ الأسرار من متغيرات البيئة على الخادم. ولا يُعرَّض مفتاح service role لحزمة المتصفح.",
        ],
      },
      {
        heading: "ما لا ندّعيه",
        body: [
          "لا نملك شهادة SOC 2 أو ISO 27001 أو ما يشابهها، ولا ندّعي امتثال PCI DSS لأنظمتنا؛ فمعالجة البطاقات موكلة إلى Stripe.",
          "لم يُجرَ أي اختبار اختراق مستقل على هذا التطبيق.",
        ],
      },
    ],
  },
  contact: {
    title: "التواصل والدعم",
    updated: UPDATED,
    draftNotice:
      "يجب استبدال قناة الدعم أدناه بصندوق بريد مُراقَب قبل الإطلاق التجاري، لأن عنوانًا مؤقتًا سيؤدي إلى فقدان طلبات العملاء بصمت.",
    sections: [
      {
        heading: "الدعم",
        body: [
          "يُقدَّم الدعم عبر البريد الإلكتروني. أرفق اسم مساحة العمل، ولمسائل الفوترة معرّف الفاتورة من Stripe.",
          "عنوان الدعم المُراقَب يُهيَّأ من مشغّل هذه النسخة، وغير مكتوب ثابتًا داخل المنتج.",
        ],
      },
      {
        heading: "توقعات الرد",
        body: [
          "الخطط العادية تحصل على دعم بالبريد، والخطط الأعلى تُوجَّه بعلامة أولوية. هذه أهداف رد وليست اتفاقيات مستوى خدمة تعاقدية.",
        ],
      },
      {
        heading: "بلاغات الأمان",
        body: [
          "إذا اعتقدت أنك وجدت مشكلة أمنية، أبلغنا بشكل خاص لا علني، مع خطوات إعادة الإنتاج. ولا تصل إلى بيانات لا تخصك أثناء التحقق.",
        ],
      },
    ],
  },
};

export const LEGAL_DOCS: Record<Locale, Record<LegalDocKey, LegalDoc>> = { en, ar };

export function getLegalDoc(locale: Locale, key: LegalDocKey): LegalDoc {
  return LEGAL_DOCS[locale][key];
}

export function isLegalDocKey(value: string): value is LegalDocKey {
  return (LEGAL_DOC_KEYS as string[]).includes(value);
}
