import type {
  Activity,
  Assignment,
  BehaviorCatalog,
  Event,
  EventMember,
  Group,
  Participant,
  User,
} from '../src/domain/types.js';

/** Demo accounts (dev tools / tests only) all share this password; it is hashed with scrypt when seeded. */
export const DEMO_PASSWORD = 'demo1234';

export const INITIAL_BEHAVIOR_CATALOG: BehaviorCatalog[] = [
  // Positive Behaviors (P01 .. P14)
  {
    id: 'b-p01',
    code: 'P01',
    label_fa: 'برای شروع یا جلو بردن کار پیشقدم شد.',
    guide_fa: 'اقدام روشن برای آغاز، حرکت دادن یا بیرون آوردن تیم از توقف.',
    polarity: 'positive',
    active: true,
    display_order: 1,
    version: 1,
  },
  {
    id: 'b-p02',
    code: 'P02',
    label_fa: 'قبل از اقدام، سؤال روشن‌کننده پرسید یا اطلاعات لازم را جمع کرد.',
    guide_fa: 'پرسش یا جمع‌آوری اطلاعاتی که مستقیماً به فهم موقعیت کمک کرد.',
    polarity: 'positive',
    active: true,
    display_order: 2,
    version: 1,
  },
  {
    id: 'b-p03',
    code: 'P03',
    label_fa: 'یک راه‌حل مشخص و قابل اجرا پیشنهاد کرد.',
    guide_fa: 'پیشنهاد باید از سطح نظر کلی بالاتر و قابل انجام باشد.',
    polarity: 'positive',
    active: true,
    display_order: 3,
    version: 1,
  },
  {
    id: 'b-p04',
    code: 'P04',
    label_fa: 'وقتی روش جواب نداد، روش را تغییر داد یا راه دیگری امتحان کرد.',
    guide_fa: 'تغییر واقعی در رویکرد پس از بازخورد، خطا یا بن‌بست.',
    polarity: 'positive',
    active: true,
    display_order: 4,
    version: 1,
  },
  {
    id: 'b-p05',
    code: 'P05',
    label_fa: 'کارهای مهم‌تر را تشخیص داد و تمرکز تیم را روی آنها برگرداند.',
    guide_fa: 'اولویت‌بندی یا جلوگیری از پخش شدن توجه تیم.',
    polarity: 'positive',
    active: true,
    display_order: 5,
    version: 1,
  },
  {
    id: 'b-p06',
    code: 'P06',
    label_fa: 'قبل از تصمیم یا اقدام، نظر دیگران را پرسید.',
    guide_fa: 'دعوت واقعی به مشارکت، نه سؤال نمایشی.',
    polarity: 'positive',
    active: true,
    display_order: 6,
    version: 1,
  },
  {
    id: 'b-p07',
    code: 'P07',
    label_fa: 'به نظر دیگران گوش داد و از نکته مفید آن در کار استفاده کرد.',
    guide_fa: 'نشانه قابل مشاهده از شنیدن و اثر دادن نظر دیگری.',
    polarity: 'positive',
    active: true,
    display_order: 7,
    version: 1,
  },
  {
    id: 'b-p08',
    code: 'P08',
    label_fa: 'عضو کم‌فعال‌تر را وارد کار کرد یا برای مشارکت او فضا ساخت.',
    guide_fa: 'دعوت، تقسیم نقش یا ایجاد فرصت مشارکت.',
    polarity: 'positive',
    active: true,
    display_order: 8,
    version: 1,
  },
  {
    id: 'b-p09',
    code: 'P09',
    label_fa: 'اطلاعات لازم را به‌موقع با تیم به اشتراک گذاشت.',
    guide_fa: 'انتقال داده، تغییر، خطا یا نکته‌ای که برای تیم لازم بود.',
    polarity: 'positive',
    active: true,
    display_order: 9,
    version: 1,
  },
  {
    id: 'b-p10',
    code: 'P10',
    label_fa: 'مسئولیت مشخصی پذیرفت و آن را تا نتیجه پیگیری کرد.',
    guide_fa: 'پذیرش + پیگیری؛ صرف اعلام «من انجام می‌دهم» کافی نیست.',
    polarity: 'positive',
    active: true,
    display_order: 10,
    version: 1,
  },
  {
    id: 'b-p11',
    code: 'P11',
    label_fa: 'اشتباه را پذیرفت و برای اصلاح آن اقدام کرد.',
    guide_fa: 'پذیرش خطا همراه با اصلاح، نه صرف گفتن «اشتباه کردم».',
    polarity: 'positive',
    active: true,
    display_order: 11,
    version: 1,
  },
  {
    id: 'b-p12',
    code: 'P12',
    label_fa: 'در فشار یا محدودیت زمان، تمرکز و رفتار خود را حفظ کرد.',
    guide_fa: 'آرامش نسبی، تمرکز روی کار و پرهیز از رفتار آشفته.',
    polarity: 'positive',
    active: true,
    display_order: 12,
    version: 1,
  },
  {
    id: 'b-p13',
    code: 'P13',
    label_fa: 'با اطلاعات موجود، در زمان مناسب تصمیم مشخص گرفت.',
    guide_fa: 'تصمیم قابل تشخیص که تیم را از بلاتکلیفی خارج کرد.',
    polarity: 'positive',
    active: true,
    display_order: 13,
    version: 1,
  },
  {
    id: 'b-p14',
    code: 'P14',
    label_fa: 'قبل از اقدام، پیامد یا ریسک مهم را مطرح کرد.',
    guide_fa: 'توجه به اثر تصمیم بر مرحله بعد، افراد، منابع یا نتیجه.',
    polarity: 'positive',
    active: true,
    display_order: 14,
    version: 1,
  },

  // Warning Behaviors (W01 .. W10)
  {
    id: 'b-w01',
    code: 'W01',
    label_fa: 'بدون اطلاعات یا هماهنگی لازم، عجولانه اقدام کرد.',
    guide_fa: 'اقدام شتاب‌زده‌ای که ریسک یا دوباره‌کاری قابل مشاهده ایجاد کرد.',
    polarity: 'warning',
    active: true,
    display_order: 15,
    version: 1,
  },
  {
    id: 'b-w02',
    code: 'W02',
    label_fa: 'حرف یا نظر دیگران را چند بار قطع یا نادیده گرفت.',
    guide_fa: 'یک قطع حرف اتفاقی کافی نیست؛ رفتار باید روشن و معنادار باشد.',
    polarity: 'warning',
    active: true,
    display_order: 16,
    version: 1,
  },
  {
    id: 'b-w03',
    code: 'W03',
    label_fa: 'اجازه مشارکت به دیگران نداد یا کار را بیش از حد در دست گرفت.',
    guide_fa: 'سلطه‌ای که عملاً مشارکت دیگران را محدود کرد.',
    polarity: 'warning',
    active: true,
    display_order: 17,
    version: 1,
  },
  {
    id: 'b-w04',
    code: 'W04',
    label_fa: 'اطلاعات لازم را منتقل نکرد یا آن‌قدر دیر گفت که به کار تیم آسیب زد.',
    guide_fa: 'فقط وقتی ثبت شود که تسهیلگر می‌داند فرد اطلاعات مرتبط را در اختیار داشته است.',
    polarity: 'warning',
    active: true,
    display_order: 18,
    version: 1,
  },
  {
    id: 'b-w05',
    code: 'W05',
    label_fa: 'مسئولیتی را پذیرفت اما بدون دلیل روشن رها کرد یا پیگیری نکرد.',
    guide_fa: 'تفاوت با تغییر تقسیم کار توافق‌شده رعایت شود.',
    polarity: 'warning',
    active: true,
    display_order: 19,
    version: 1,
  },
  {
    id: 'b-w06',
    code: 'W06',
    label_fa: 'در زمان خطا یا مشکل، مسئولیت را به دیگران منتقل کرد.',
    guide_fa: 'سرزنش یا فاصله گرفتن از سهم خود در مسئله.',
    polarity: 'warning',
    active: true,
    display_order: 20,
    version: 1,
  },
  {
    id: 'b-w07',
    code: 'W07',
    label_fa: 'با وجود شواهد شکست، بی‌دلیل روی همان روش ماند.',
    guide_fa: 'اصرار قابل مشاهده بدون آزمون یا استدلال تازه.',
    polarity: 'warning',
    active: true,
    display_order: 21,
    version: 1,
  },
  {
    id: 'b-w08',
    code: 'W08',
    label_fa: 'در فشار، تمرکز یا کنترل رفتاری خود را به شکل محسوسی از دست داد.',
    guide_fa: 'آشفتگی‌ای که بر کار یا تعامل اثر گذاشت.',
    polarity: 'warning',
    active: true,
    display_order: 22,
    version: 1,
  },
  {
    id: 'b-w09',
    code: 'W09',
    label_fa: 'اختلاف را شدیدتر کرد یا تنش غیرضروری ساخت.',
    guide_fa: 'رفتاری که حل مسئله را سخت‌تر کرد، نه صرف اختلاف نظر.',
    polarity: 'warning',
    active: true,
    display_order: 23,
    version: 1,
  },
  {
    id: 'b-w10',
    code: 'W10',
    label_fa: 'وقتی تصمیم لازم بود، آن را آن‌قدر عقب انداخت که کار تیم مختل شد.',
    guide_fa: 'تأخیر باید اثر عملی داشته باشد؛ احتیاط عادی منفی نیست.',
    polarity: 'warning',
    active: true,
    display_order: 24,
    version: 1,
  },
];

export const INITIAL_USERS: User[] = [
  {
    id: 'u-sysadmin',
    full_name: 'مدیر ارشد سامانه',
    mobile_or_username: 'sysadmin',
    password_hash: '', // filled in by seedDemo()
    role: 'SYSTEM_ADMIN',
    status: 'Active',
  },
  {
    id: 'u-eventadmin',
    full_name: 'دکتر علیرضا شمس (مدیر رویداد)',
    mobile_or_username: 'eventadmin',
    password_hash: '', // filled in by seedDemo()
    role: 'EVENT_ADMIN',
    status: 'Active',
  },
  {
    id: 'u-fac1',
    full_name: 'سارا احمدی',
    mobile_or_username: 'fac1',
    password_hash: '', // filled in by seedDemo()
    role: 'FACILITATOR',
    status: 'Active',
  },
  {
    id: 'u-fac2',
    full_name: 'رضا کریمی',
    mobile_or_username: 'fac2',
    password_hash: '', // filled in by seedDemo()
    role: 'FACILITATOR',
    status: 'Active',
  },
  {
    id: 'u-fac3',
    full_name: 'مریم حسینی',
    mobile_or_username: 'fac3',
    password_hash: '', // filled in by seedDemo()
    role: 'FACILITATOR',
    status: 'Active',
  },
  {
    id: 'u-fac4',
    full_name: 'علی مرادی',
    mobile_or_username: 'fac4',
    password_hash: '', // filled in by seedDemo()
    role: 'FACILITATOR',
    status: 'Active',
  },
  {
    id: 'u-fac5',
    full_name: 'فرشته نوری',
    mobile_or_username: 'fac5',
    password_hash: '', // filled in by seedDemo()
    role: 'FACILITATOR',
    status: 'Active',
  },
  {
    id: 'u-fac6',
    full_name: 'کیانوش صادقی',
    mobile_or_username: 'fac6',
    password_hash: '', // filled in by seedDemo()
    role: 'FACILITATOR',
    status: 'Active',
  },
  {
    id: 'u-fac7',
    full_name: 'نیلوفر راد',
    mobile_or_username: 'fac7',
    password_hash: '', // filled in by seedDemo()
    role: 'FACILITATOR',
    status: 'Active',
  },
  {
    id: 'u-fac8',
    full_name: 'پدرام رستم‌پور',
    mobile_or_username: 'fac8',
    password_hash: '', // filled in by seedDemo()
    role: 'FACILITATOR',
    status: 'Active',
  },
];

export const INITIAL_EVENT: Event = {
  id: 'EVT-BOOTCAMP-2026',
  title: 'بوت‌کمپ سنجش تعاملی بهار ۱۴۰۵',
  event_date: '2026-10-05',
  location: 'مرکز همایش‌های بین‌المللی',
  description: 'دوره فشرده ارزیابی و مشاهده رفتاری تیم‌های پروژه در حل مسائل پیچیده',
  status: 'Active',
  created_by: 'u-sysadmin',
};

export const INITIAL_EVENT_MEMBERS: EventMember[] = [
  { id: 'em-1', event_id: INITIAL_EVENT.id, user_id: 'u-eventadmin', role: 'EVENT_ADMIN' },
  { id: 'em-2', event_id: INITIAL_EVENT.id, user_id: 'u-fac1', role: 'FACILITATOR' },
  { id: 'em-3', event_id: INITIAL_EVENT.id, user_id: 'u-fac2', role: 'FACILITATOR' },
  { id: 'em-4', event_id: INITIAL_EVENT.id, user_id: 'u-fac3', role: 'FACILITATOR' },
  { id: 'em-5', event_id: INITIAL_EVENT.id, user_id: 'u-fac4', role: 'FACILITATOR' },
  { id: 'em-6', event_id: INITIAL_EVENT.id, user_id: 'u-fac5', role: 'FACILITATOR' },
  { id: 'em-7', event_id: INITIAL_EVENT.id, user_id: 'u-fac6', role: 'FACILITATOR' },
  { id: 'em-8', event_id: INITIAL_EVENT.id, user_id: 'u-fac7', role: 'FACILITATOR' },
  { id: 'em-9', event_id: INITIAL_EVENT.id, user_id: 'u-fac8', role: 'FACILITATOR' },
];

export const INITIAL_GROUPS: Group[] = Array.from({ length: 8 }).map((_, idx) => {
  const num = idx + 1;
  const code = `0${num}G`;
  return {
    id: `grp-${code}`,
    event_id: INITIAL_EVENT.id,
    code: code,
    title: `گروه ${num}`,
  };
});

const PERSIAN_FIRST_NAMES = [
  'آرش', 'سحر', 'مهدی', 'نازنین', 'نوید', 'پریا', 'دانیال', 'یگانه',
  'کامران', 'بهاره', 'سینا', 'المیرا', 'شهاب', 'نگین', 'امید', 'طناز',
  'پویا', 'مهسا', 'احسان', 'شکوفه', 'سامان', 'مینا', 'حمید', 'آیدا',
  'کیارش', 'رویا', 'محسن', 'فرناز', 'عرفان', 'هلیا', 'شاهین', 'سوگل',
  'مجید', 'شیرین', 'آرمان', 'غزل', 'فرهاد', 'پانته‌آ', 'میلاد', 'کتایون',
  'فرزین', 'پگاه', 'بابک', 'مرجان', 'وحید', 'لاله', 'ماهان', 'سمیرا',
  'هومن', 'ترانه', 'بهرام', 'سیمین', 'پیمان', 'شیدا', 'یاشار', 'نسترن',
  'سیامک', 'نسیم', 'پاشا', 'مهنوش', 'کسری', 'آناهیتا', 'رامین', 'گلناز',
];

const PERSIAN_LAST_NAMES = [
  'رضایی', 'اکبری', 'صابری', 'شفیعی', 'کاظمی', 'موسوی', 'خسروی', 'قادری',
  'تهرانی', 'بهشتی', 'یزدانی', 'مختاری', 'صالحی', 'پاشایی', 'افشار', 'فرهادی',
  'جعفری', 'عسکری', 'توکلی', 'طاهری', 'کمالی', 'امانی', 'میرزایی', 'حق‌شناس',
  'دانشور', 'روشن', 'سرداری', 'فاتح', 'نجفی', 'دهقان', 'باقری', 'انصاری',
  'غلامی', 'شمس', 'کیانی', 'قاسمی', 'سلیمانی', 'سهرابی', 'شجاعی', 'مقدم',
  'عباسی', 'فروغی', 'زاهدی', 'نیک‌نژاد', 'یوسفی', 'ستوده', 'صادقیان', 'خلیلی',
  'اصغری', 'جمشیدی', 'بهمنش', 'کریمیان', 'شریفی', 'فرهمند', 'معتمدی', 'پارسا',
  'مهرابی', 'دادگر', 'نامدار', 'شکیبا', 'امیرپور', 'ملکی', 'فخار', 'هدایتی',
];

export const INITIAL_PARTICIPANTS: Participant[] = Array.from({ length: 64 }).map((_, idx) => {
  const num = idx + 1;
  const pad = String(num).padStart(3, '0');
  const groupIndex = Math.floor(idx / 8);
  const groupCode = `0${groupIndex + 1}G`;
  const groupId = `grp-${groupCode}`;
  const firstName = PERSIAN_FIRST_NAMES[idx % PERSIAN_FIRST_NAMES.length];
  const lastName = PERSIAN_LAST_NAMES[idx % PERSIAN_LAST_NAMES.length];

  return {
    id: `pt-${pad}`,
    event_id: INITIAL_EVENT.id,
    participant_code: `PT-${pad}`,
    full_name: `${firstName} ${lastName}`,
    personnel_code: `EMP-9${pad}`,
    organization: 'پژوهشگاه نوآوری',
    job_title: idx % 4 === 0 ? 'سرپرست تیم' : idx % 3 === 0 ? 'کارشناس ارشد محصول' : 'کارشناس سیستم‌ها',
    group_id: groupId,
    status: 'Active',
  };
});

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: 'ACT-01',
    event_id: INITIAL_EVENT.id,
    title: 'چالش پله‌های نجات (هماهنگی عملیاتی)',
    order_no: 1,
    status: 'Open',
    opened_at: '2026-10-05T09:00:00+03:30',
  },
  {
    id: 'ACT-02',
    event_id: INITIAL_EVENT.id,
    title: 'شبیه‌سازی اتاق فرمان (مدیریت بحران)',
    order_no: 2,
    status: 'Open',
    opened_at: '2026-10-05T11:00:00+03:30',
  },
  {
    id: 'ACT-03',
    event_id: INITIAL_EVENT.id,
    title: 'بازی معاملاتی جزیره (مذاکره و تخصیص منابع)',
    order_no: 3,
    status: 'Draft',
  },
  {
    id: 'ACT-04',
    event_id: INITIAL_EVENT.id,
    title: 'معمای منابع محدود (اولویت‌بندی و بازخورد)',
    order_no: 4,
    status: 'Draft',
  },
  {
    id: 'ACT-05',
    event_id: INITIAL_EVENT.id,
    title: 'پل ارتباطی گروه‌ها (همکاری بین‌تیمی)',
    order_no: 5,
    status: 'Draft',
  },
  {
    id: 'ACT-06',
    event_id: INITIAL_EVENT.id,
    title: 'رالی تصمیم‌گیری سریع (جمع‌بندی نهایی)',
    order_no: 6,
    status: 'Draft',
  },
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  // Activity 1: Group i to Facilitator i
  ...INITIAL_GROUPS.map((grp, idx) => ({
    id: `asg-act1-grp${idx + 1}`,
    event_id: INITIAL_EVENT.id,
    activity_id: 'ACT-01',
    facilitator_id: `u-fac${idx + 1}`,
    kind: 'group' as const,
    group_id: grp.id,
    status: 'Active' as const,
    created_at: '2026-10-05T08:30:00+03:30',
  })),

  // Activity 2: Shifted by 1 (Group i to Facilitator (i mod 8) + 1)
  ...INITIAL_GROUPS.map((grp, idx) => {
    const shiftedFacIndex = ((idx + 1) % 8) + 1;
    return {
      id: `asg-act2-grp${idx + 1}`,
      event_id: INITIAL_EVENT.id,
      activity_id: 'ACT-02',
      facilitator_id: `u-fac${shiftedFacIndex}`,
      kind: 'group' as const,
      group_id: grp.id,
      status: 'Active' as const,
      created_at: '2026-10-05T08:30:00+03:30',
    };
  }),
];
