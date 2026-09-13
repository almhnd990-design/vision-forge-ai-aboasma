export type Locale = "en" | "ar";
export const isLocale = (value: string): value is Locale =>
  value === "en" || value === "ar";
export const dictionaries = {
  en: {
    lang: "العربية",
    nav: ["Platform", "How it works", "Built on trust"],
    enter: "Open command center",
    eyebrow: "YOUR BUSINESS DESERVES A DEFENDER",
    hero1: "The things you miss.",
    hero2: "The edge you need.",
    heroCopy:
      "Meet your invisible operator. Turn scattered business signals into clear opportunities to recover revenue, protect margins, and move forward.",
    cta: "Meet your command center",
    secondary: "See the workflow",
    heroNote: "Evidence first. You stay in control.",
    orbit1: "Every signal has a story",
    orbit2: "Find your next best move",
    orbit3: "Your judgment. Amplified.",
    platforms: "A clearer view of the systems behind your business",
    integrationNote: "Integration roadmap · connections require setup",
    valueEyebrow: "LESS NOISE. MORE CLARITY.",
    valueTitle: "A second set of eyes.\nA whole new perspective.",
    valueCopy:
      "Bring your business snapshot. GhostOps connects the dots and gives every finding a reason, a priority, and a next step.",
    features: [
      [
        "Recovery intelligence",
        "Spot pending refunds and potential duplicate charges. Review the evidence before pursuing a recovery.",
      ],
      [
        "Growth, in focus",
        "Surface meaningful revenue changes and identify the questions worth investigating next.",
      ],
      [
        "Stay a step ahead",
        "Recognize inventory pressure early, while there is still time to make a better decision.",
      ],
    ],
    workflowEyebrow: "FROM SIGNAL TO NEXT STEP",
    workflowTitle: "A little less guesswork.\nA lot more direction.",
    steps: [
      [
        "Bring the context",
        "Import a business snapshot or enter your numbers in a private, local workspace.",
      ],
      [
        "Find the signal",
        "The analytics engine checks revenue changes, refund balances, and inventory coverage.",
      ],
      [
        "Review the evidence",
        "Explore the reasoning and record your review. External actions always need a separate connection.",
      ],
    ],
    trustEyebrow: "YOUR BUSINESS. YOUR CALL.",
    trustTitle: "Confidence comes\nfrom control.",
    trustCopy:
      "A finding is the beginning of a conversation, never permission to act on your behalf.",
    trust: [
      [
        "Evidence, not a black box",
        "Each insight shows the numbers behind it.",
      ],
      [
        "Decisions stay with you",
        "Review sensitive findings before taking action.",
      ],
      ["Privacy by design", "Your workspace analysis stays in this browser."],
    ],
    pricing: {
      eyebrow: "PLANS",
      title: "Priced for the money it finds.",
      copy: "Start with the numbers you already have. Move up when you connect more storefronts. Cancel whenever you want.",
      monthly: "Monthly",
      perMonth: "per month",
      trialBadge: "{{days}}-day trial",
      mostPopular: "Most popular",
      includes: "What this plan includes",
      limits: "Your limits",
      cta: "Start free trial",
      ctaSignIn: "Sign in to subscribe",
      compare: "Compare plans",
      limitsLabel: {
        workspaces: "Businesses",
        analyses: "Analyses",
        providers: "Connected providers",
        retention: "Data retention",
        support: "Support",
      },
      limitValue: {
        unlimited: "Unlimited",
        perMonth: "per month",
        days: "days",
        none: "Not included",
      },
      support: {
        standard: "Standard email support",
        priority: "Priority support",
        dedicated: "Dedicated support",
      },
      checkoutUnavailableTitle: "Checkout is not available on this deployment",
      checkoutUnavailableCopy:
        "Stripe is not fully configured, so no payment can be taken. The plans below are the real launch prices; they are shown so the offer can be reviewed.",
      requiredEnv: "Required configuration",
      faqTitle: "Pricing questions",
      faq: [
        [
          "What exactly am I paying for?",
          "A cloud workspace that stores your business snapshots and findings, the deterministic analysis engine, the AI reasoning layer, the human-approval workflow with its audit trail, and the Stripe connector that builds snapshots from your own payments data.",
        ],
        [
          "Is the free trial a real trial?",
          "Yes. The trial length is defined per plan in one configuration file. It requires a payment method through Stripe to start, and it converts to a paid subscription unless you cancel before it ends.",
        ],
        [
          "Do you take a cut of the money you find?",
          "No. GhostOps is a subscription. We never charge a percentage of a recovery, and we never move money on your behalf.",
        ],
        [
          "Why are prices in SAR?",
          "GhostOps is built for operators selling into the Saudi market. Prices, invoices and currency formatting are all in Saudi Riyal.",
        ],
        [
          "What happens if a payment fails?",
          "Stripe retries the payment and we mark the account past due immediately. Paid features pause until the payment succeeds, and nothing is deleted.",
        ],
        [
          "Can I cancel on my own?",
          "Yes, from the billing portal in account settings. There is no email required and no retention call. Access continues until the end of the period you already paid for.",
        ],
      ],
      honestNotice:
        "Not every item on this page is available today. Scheduled background scans and team seats are on the roadmap and are labelled as such wherever they appear.",
    },
    finalTitle: "Give your business\nan unfair attention advantage.",
    finalCopy:
      "Start with the numbers you already have. Find the questions you should be asking.",
    footer: "Your business deserves a defender.",
    footerNote: "Built for a more intentional way to operate.",
    dash: {
      nav: [
        "Overview",
        "Intelligence",
        "Recovery cases",
        "Review center",
        "Connections",
        "Activity",
      ],
      workspace: "My workspace",
      local: "Local workspace",
      localDetail: "Analysis runs in this browser. No services are connected.",
      title: "A clearer picture starts here.",
      subtitle:
        "Your signals, opportunities, and next best steps. All in one place.",
      import: "Import snapshot",
      export: "Export report",
      edit: "Update snapshot",
      add: "Add business data",
      emptyTitle: "Meet your invisible operator.",
      emptyCopy:
        "Add a business snapshot to uncover meaningful signals. Your real numbers will shape the insights here.",
      metric: [
        "Revenue change",
        "Pending refunds",
        "Open insights",
        "Needs review",
      ],
      priority: "Priority intelligence",
      viewAll: "View all insights",
      none: "Nothing to review here.",
      noneCopy: "Your current snapshot has no findings in this category.",
      review: "Review insight",
      reviewed: "Reviewed",
      unreviewed: "Needs review",
      evidence: "Supporting evidence",
      nextStep: "Recommended next step",
      mark: "Mark as reviewed",
      unmark: "Reopen review",
      close: "Close",
      decisionNote:
        "This records your review locally. It does not contact a provider or move money.",
      search: "Search insights…",
      all: "All priorities",
      high: "High / critical",
      medium: "Medium",
      kind: {
        recovery: "Recovery",
        growth: "Growth",
        operations: "Operations",
        risk: "Risk",
      },
      severity: {
        low: "Low",
        medium: "Medium",
        high: "High",
        critical: "Critical",
      },
      panelTitle: "Your next move",
      panelCopy:
        "Good decisions start with good context. Keep your snapshot current and review the evidence behind each finding.",
      dataTitle: "Business snapshot",
      dataCopy:
        "Use values from the same business and comparable reporting periods. All amounts below are in Saudi riyals (SAR).",
      fields: [
        "Workspace name",
        "Current revenue (SAR)",
        "Previous revenue (SAR)",
        "Pending refunds (SAR)",
        "Inventory coverage (days, optional)",
      ],
      duplicate: "Possible duplicate charges",
      duplicateCopy:
        "Add candidates you identified for review; a candidate is not a confirmed duplicate.",
      addCharge: "Add candidate",
      remove: "Remove",
      description: "Description",
      amount: "Amount (SAR)",
      save: "Analyze snapshot",
      cancel: "Cancel",
      invalid:
        "Check your numbers. Amounts must be nonnegative, with at most two decimal places. Candidate amounts must be positive.",
      importHelp:
        "Upload JSON matching the snapshot template. Amounts in the JSON are in cents (halalas). Maximum file size: 100 KB.",
      template: "Download JSON template",
      privacy:
        "Your workspace data is saved only in this browser. Use Export to keep a copy.",
      reset: "Clear workspace",
      resetConfirm:
        "Clear this browser’s snapshot, insights, and review history? This cannot be undone.",
      saved: "Snapshot analyzed. Your insights are ready.",
      imported: "Snapshot imported and analyzed.",
      importError:
        "Could not import this file. Use the JSON template and check the values.",
      storageError:
        "Browser storage is unavailable or full. Your session still works, but changes will not survive a refresh. Export a copy.",
      corrupt:
        "Saved data could not be loaded. Import a valid snapshot to continue.",
      activityTitle: "A trail you can follow.",
      activityCopy: "Snapshot updates and reviews made in this browser.",
      noActivity: "Your activity will appear here.",
      analyzed: "Business snapshot analyzed",
      reviewEvent: "Insight marked as reviewed",
      reopened: "Insight review reopened",
      connectionsTitle: "Your tools. One connected vision.",
      connectionsCopy:
        "These integrations are on the roadmap. This release analyzes the snapshots you provide; it does not access these accounts.",
      setup: "View requirements",
      notConnected: "Not connected",
      planned: "Planned integration",
      integrationDetail:
        "Requires an implemented connector, provider authorization, and secure server configuration. Adding a key alone does not activate this integration.",
      providerDescriptions: [
        "Orders, refunds, and storefront performance",
        "Charges, refunds, and settlements",
        "Seller fees, orders, and reimbursements",
        "Business correspondence and supporting records",
      ],
      connectionPrivacy:
        "Never upload passwords or API keys in a business snapshot.",
      status: "Workspace status",
      ready: "Snapshot ready",
      waiting: "Awaiting your data",
      last: "Last analysis",
      titles: [
        "Overview",
        "Intelligence",
        "Recovery cases",
        "Review center",
        "Connections",
        "Activity log",
      ],
      unknownTime: "Not yet analyzed",
      home: "Back to home",
      snapshot: "Snapshot",
      total: "Total insights",
      approvedCount: "Reviewed",
      signalRevenue: "Revenue declined",
      signalRefund: "Pending refunds need reconciliation",
      signalDuplicate: "Possible duplicate charge",
      signalStock: "Inventory coverage is low",
      summaryRevenue:
        "Revenue is below the comparison period. Review traffic, conversion, pricing, and stock availability before drawing conclusions.",
      summaryRefund:
        "Your snapshot contains a pending refund balance. Reconcile it against settlement records.",
      summaryStock:
        "The inventory coverage you provided is below ten days. Review replenishment lead times.",
      actionRevenue:
        "Compare traffic, conversion, pricing, advertising spend, and availability across both periods.",
      actionRefund:
        "Match pending refund records against payment settlements and document unresolved items.",
      actionDuplicate:
        "Verify transaction references and amounts before preparing a recovery request.",
      actionStock: "Check replenishment lead time and plan the next order.",
      currentRevenue: "Current revenue",
      previousRevenue: "Previous revenue",
      pendingRefund: "Pending refund balance",
      inventoryDays: "Days of inventory",
      candidateAmount: "Candidate amount",
      candidateRef: "Candidate reference",
    },
  },
  ar: {
    lang: "English",
    nav: ["المنصة", "كيف تعمل", "الثقة والأمان"],
    enter: "افتح مركز القيادة",
    eyebrow: "أعمالك تستحق من يدافع عنها",
    hero1: "تفاصيل تفوتك.",
    hero2: "فرص تنتظرك.",
    heroCopy:
      "تعرّف على مشغّلك الخفي. حوّل إشارات أعمالك المتفرقة إلى فرص واضحة لاستعادة الإيرادات، وحماية هوامش الربح، واتخاذ الخطوة التالية.",
    cta: "اكتشف مركز القيادة",
    secondary: "شاهد آلية العمل",
    heroNote: "الأدلة أولًا. والقرار لك دائمًا.",
    orbit1: "وراء كل إشارة حكاية",
    orbit2: "اكتشف خطوتك التالية",
    orbit3: "رؤيتك. بوضوح أكبر.",
    platforms: "رؤية أوضح للأنظمة التي تدير أعمالك",
    integrationNote: "تكاملات مخططة · الربط يحتاج إلى إعداد",
    valueEyebrow: "ضجيج أقل. رؤية أوضح.",
    valueTitle: "عين ثانية على أعمالك.\nومنظور جديد للفرص.",
    valueCopy:
      "أضف ملخص بيانات أعمالك. يربط GhostOps بين الإشارات ويمنح كل نتيجة سببًا واضحًا وأولوية وخطوة مقترحة.",
    features: [
      [
        "ذكاء الاسترداد",
        "اكتشف المبالغ المعلقة والرسوم المحتمل تكرارها. راجع الأدلة قبل متابعة أي استرداد.",
      ],
      [
        "النمو في دائرة الضوء",
        "ارصد التغيرات المهمة في الإيرادات وحدد الأسئلة التي تستحق التحليل.",
      ],
      [
        "اسبق التحديات بخطوة",
        "تنبّه لضغط المخزون مبكرًا، حين يكون أمامك وقت لاتخاذ قرار أفضل.",
      ],
    ],
    workflowEyebrow: "من الإشارة إلى الخطوة التالية",
    workflowTitle: "تخمين أقل.\nواتجاه أكثر وضوحًا.",
    steps: [
      [
        "أضف السياق",
        "استورد ملخص أعمالك أو أدخل أرقامك في مساحة عمل محلية خاصة.",
      ],
      [
        "اكتشف الإشارة",
        "يحلل المحرك تغير الإيرادات والمبالغ المعلقة وتغطية المخزون.",
      ],
      [
        "راجع الأدلة",
        "اطّلع على الأسباب وسجّل مراجعتك. تنفيذ الإجراءات الخارجية يتطلب ربطًا منفصلًا.",
      ],
    ],
    trustEyebrow: "أعمالك. قرارك.",
    trustTitle: "الثقة تبدأ\nمن سيطرتك.",
    trustCopy: "كل نتيجة بداية لفهم أفضل، وليست إذنًا بالتصرف نيابة عنك.",
    trust: [
      ["أدلة واضحة أمامك", "كل نتيجة تعرض الأرقام التي تستند إليها."],
      ["أنت صاحب القرار", "راجع النتائج الحساسة قبل اتخاذ أي إجراء."],
      ["الخصوصية من الأساس", "تحليل مساحة العمل يبقى داخل هذا المتصفح."],
    ],
    pricing: {
      eyebrow: "الخطط",
      title: "أسعار على قدر القيمة التي نكشفها.",
      copy: "ابدأ بالأرقام التي تملكها بالفعل، وارتقِ عندما تربط متاجر أكثر. الإلغاء متاح في أي وقت.",
      monthly: "شهريًا",
      perMonth: "شهريًا",
      trialBadge: "تجربة {{days}} يومًا",
      mostPopular: "الأكثر اختيارًا",
      includes: "ما تشمله هذه الخطة",
      limits: "حدودك",
      cta: "ابدأ التجربة المجانية",
      ctaSignIn: "سجّل الدخول للاشتراك",
      compare: "قارن الخطط",
      limitsLabel: {
        workspaces: "الأنشطة التجارية",
        analyses: "التحليلات",
        providers: "المصادر المرتبطة",
        retention: "الاحتفاظ بالبيانات",
        support: "الدعم",
      },
      limitValue: {
        unlimited: "غير محدود",
        perMonth: "شهريًا",
        days: "يومًا",
        none: "غير مشمول",
      },
      support: {
        standard: "دعم بالبريد الإلكتروني",
        priority: "دعم بأولوية",
        dedicated: "دعم مخصص",
      },
      checkoutUnavailableTitle: "الدفع غير متاح في هذه النسخة",
      checkoutUnavailableCopy:
        "لم تُهيَّأ Stripe بالكامل، لذلك لا يمكن تحصيل أي مبلغ. الأسعار المعروضة أدناه هي أسعار الإطلاق الحقيقية، ونعرضها لمراجعة العرض.",
      requiredEnv: "الإعدادات المطلوبة",
      faqTitle: "أسئلة عن الأسعار",
      faq: [
        [
          "ما الذي أدفع مقابله تحديدًا؟",
          "مساحة عمل سحابية تحفظ بياناتك ونتائجك، ومحرك التحليل الحتمي، وطبقة الاستدلال بالذكاء الاصطناعي، ومسار الموافقة البشرية مع سجل التدقيق، وموصل Stripe الذي يبني اللقطات من بيانات مدفوعاتك.",
        ],
        [
          "هل التجربة المجانية حقيقية؟",
          "نعم. مدة التجربة محددة لكل خطة في ملف تهيئة واحد. تتطلب طريقة دفع عبر Stripe للبدء، وتتحول إلى اشتراك مدفوع ما لم تُلغِ قبل انتهائها.",
        ],
        [
          "هل تأخذون نسبة من الأموال التي تكشفونها؟",
          "لا. GhostOps اشتراك ثابت. لا نتقاضى نسبة من أي استرداد، ولا نحرّك أي مبلغ نيابة عنك.",
        ],
        [
          "لماذا الأسعار بالريال السعودي؟",
          "GhostOps مبني لمن يعملون في السوق السعودي. الأسعار والفواتير وتنسيق العملة كلها بالريال السعودي.",
        ],
        [
          "ماذا يحدث إذا فشل الدفع؟",
          "تعيد Stripe المحاولة، ونضع الحساب في حالة \"متأخر\" فورًا. تتوقف المزايا المدفوعة حتى نجاح الدفع، ولا يُحذف أي شيء.",
        ],
        [
          "هل أستطيع الإلغاء بنفسي؟",
          "نعم، من بوابة الفوترة في إعدادات الحساب. لا حاجة لمراسلتنا ولا لمكالمة. ويستمر وصولك حتى نهاية الفترة المدفوعة.",
        ],
      ],
      honestNotice:
        "ليست كل بند في هذه الصفحة متاحًا اليوم. الفحوصات المجدولة في الخلفية ومقاعد الفريق على خطة التطوير، وهي موسومة بذلك في كل مكان تظهر فيه.",
    },
    finalTitle: "امنح أعمالك\nالاهتمام الذي تستحقه.",
    finalCopy: "ابدأ بالأرقام المتاحة لديك. واكتشف الأسئلة التي تصنع الفرق.",
    footer: "أعمالك تستحق من يدافع عنها.",
    footerNote: "صُمّم لطريقة أكثر وعيًا في إدارة الأعمال.",
    dash: {
      nav: [
        "نظرة عامة",
        "الرؤى والتحليلات",
        "حالات الاسترداد",
        "مركز المراجعة",
        "التكاملات",
        "سجل النشاط",
      ],
      workspace: "مساحة عملي",
      local: "مساحة عمل محلية",
      localDetail: "يعمل التحليل في هذا المتصفح. لا توجد خدمات مرتبطة.",
      title: "الصورة الأوضح تبدأ هنا.",
      subtitle: "إشارات أعمالك وفرصك وخطواتك التالية، في مكان واحد.",
      import: "استيراد البيانات",
      export: "تصدير التقرير",
      edit: "تحديث البيانات",
      add: "أضف بيانات أعمالك",
      emptyTitle: "تعرّف على مشغّلك الخفي.",
      emptyCopy:
        "أضف ملخص بيانات أعمالك لاكتشاف الإشارات المهمة. أرقامك الحقيقية هي أساس الرؤى التي ستظهر هنا.",
      metric: ["تغير الإيرادات", "مبالغ معلقة", "رؤى متاحة", "تحتاج مراجعة"],
      priority: "رؤى تستحق انتباهك",
      viewAll: "عرض جميع الرؤى",
      none: "لا توجد نتائج للمراجعة.",
      noneCopy: "لا يتضمن ملخصك الحالي نتائج ضمن هذه الفئة.",
      review: "راجع النتيجة",
      reviewed: "تمت المراجعة",
      unreviewed: "تحتاج مراجعة",
      evidence: "الأدلة الداعمة",
      nextStep: "الخطوة المقترحة",
      mark: "تسجيل المراجعة",
      unmark: "إعادة فتح المراجعة",
      close: "إغلاق",
      decisionNote:
        "يُحفظ قرار المراجعة محليًا. لا يُرسل إلى أي مزود ولا ينفذ أي تحويل مالي.",
      search: "ابحث في الرؤى…",
      all: "جميع الأولويات",
      high: "عالية / حرجة",
      medium: "متوسطة",
      kind: {
        recovery: "استرداد",
        growth: "نمو",
        operations: "عمليات",
        risk: "مخاطر",
      },
      severity: {
        low: "منخفضة",
        medium: "متوسطة",
        high: "عالية",
        critical: "حرجة",
      },
      panelTitle: "خطوتك التالية",
      panelCopy:
        "القرارات الجيدة تبدأ بسياق واضح. حدّث بياناتك باستمرار وراجع الأدلة وراء كل نتيجة.",
      dataTitle: "ملخص بيانات الأعمال",
      dataCopy:
        "استخدم أرقام النشاط نفسه وفترات قابلة للمقارنة. جميع المبالغ أدناه بالريال السعودي.",
      fields: [
        "اسم مساحة العمل",
        "الإيراد الحالي (ر.س)",
        "الإيراد السابق (ر.س)",
        "مبالغ الاسترداد المعلقة (ر.س)",
        "تغطية المخزون بالأيام (اختياري)",
      ],
      duplicate: "رسوم يُحتمل تكرارها",
      duplicateCopy:
        "أضف الحالات التي حددتها للمراجعة؛ وجود حالة لا يعني تأكيد تكرار الرسوم.",
      addCharge: "إضافة حالة",
      remove: "حذف",
      description: "الوصف",
      amount: "المبلغ (ر.س)",
      save: "تحليل البيانات",
      cancel: "إلغاء",
      invalid:
        "راجع الأرقام. يجب أن تكون المبالغ غير سالبة وبمنزلتين عشريتين كحد أقصى، ومبالغ الحالات موجبة.",
      importHelp:
        "ارفع ملف JSON مطابقًا للقالب. المبالغ داخل الملف بالهللات. الحد الأقصى 100 كيلوبايت.",
      template: "تنزيل قالب JSON",
      privacy:
        "تُحفظ بياناتك في هذا المتصفح فقط. استخدم التصدير للاحتفاظ بنسخة.",
      reset: "مسح مساحة العمل",
      resetConfirm:
        "هل تريد مسح بيانات هذا المتصفح ورؤاه وسجل مراجعته؟ لا يمكن التراجع عن ذلك.",
      saved: "اكتمل التحليل وأصبحت الرؤى جاهزة.",
      imported: "تم استيراد البيانات وتحليلها.",
      importError: "تعذر استيراد الملف. استخدم قالب JSON وتحقق من القيم.",
      storageError:
        "التخزين المحلي غير متاح أو ممتلئ. يمكنك المتابعة، لكن التغييرات لن تبقى بعد التحديث. صدّر نسخة منها.",
      corrupt: "تعذر قراءة البيانات المحفوظة. استورد ملخصًا صالحًا للمتابعة.",
      activityTitle: "كل خطوة واضحة.",
      activityCopy: "تحديثات البيانات والمراجعات المسجلة في هذا المتصفح.",
      noActivity: "سيظهر نشاطك هنا.",
      analyzed: "تم تحليل بيانات الأعمال",
      reviewEvent: "تمت مراجعة النتيجة",
      reopened: "أُعيد فتح مراجعة النتيجة",
      connectionsTitle: "أدواتك. ورؤية متكاملة.",
      connectionsCopy:
        "هذه التكاملات ضمن خطة التطوير. يحلل هذا الإصدار البيانات التي تقدمها، ولا يصل إلى هذه الحسابات.",
      setup: "متطلبات الربط",
      notConnected: "غير مرتبط",
      planned: "تكامل مخطط",
      integrationDetail:
        "يتطلب الربط تطوير الموصل، وتفويض مزود الخدمة، وإعدادًا آمنًا على الخادم. إضافة مفتاح وحدها لا تفعّل التكامل.",
      providerDescriptions: [
        "الطلبات والاستردادات وأداء المتجر",
        "الرسوم والاستردادات والتسويات",
        "رسوم البائع والطلبات والتعويضات",
        "مراسلات العمل والمستندات الداعمة",
      ],
      connectionPrivacy:
        "لا ترفع كلمات المرور أو مفاتيح API ضمن بيانات أعمالك.",
      status: "حالة مساحة العمل",
      ready: "البيانات جاهزة",
      waiting: "بانتظار بياناتك",
      last: "آخر تحليل",
      titles: [
        "نظرة عامة",
        "الرؤى والتحليلات",
        "حالات الاسترداد",
        "مركز المراجعة",
        "التكاملات",
        "سجل النشاط",
      ],
      unknownTime: "لم يتم التحليل بعد",
      home: "العودة للرئيسية",
      snapshot: "البيانات",
      total: "إجمالي الرؤى",
      approvedCount: "تمت مراجعتها",
      signalRevenue: "انخفاض في الإيرادات",
      signalRefund: "مبالغ معلقة تحتاج إلى مطابقة",
      signalDuplicate: "رسوم يُحتمل تكرارها",
      signalStock: "تغطية المخزون منخفضة",
      summaryRevenue:
        "الإيراد أقل من فترة المقارنة. راجع الزيارات والتحويل والتسعير وتوفر المخزون قبل استنتاج الأسباب.",
      summaryRefund:
        "تتضمن بياناتك رصيد استرداد معلقًا. طابقه مع سجلات التسوية.",
      summaryStock:
        "تغطية المخزون التي أدخلتها أقل من عشرة أيام. راجع مواعيد التوريد.",
      actionRevenue:
        "قارن الزيارات والتحويل والتسعير والإنفاق الإعلاني وتوفر المنتجات بين الفترتين.",
      actionRefund:
        "طابق الاستردادات المعلقة مع التسويات ووثّق الحالات غير المحسومة.",
      actionDuplicate: "تحقق من مراجع العمليات ومبالغها قبل إعداد طلب استرداد.",
      actionStock: "راجع مدة التوريد وخطط للطلب التالي.",
      currentRevenue: "الإيراد الحالي",
      previousRevenue: "الإيراد السابق",
      pendingRefund: "رصيد الاسترداد المعلق",
      inventoryDays: "أيام تغطية المخزون",
      candidateAmount: "مبلغ الحالة",
      candidateRef: "مرجع الحالة",
    },
  },
};
export type Dictionary = typeof dictionaries.en;
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
