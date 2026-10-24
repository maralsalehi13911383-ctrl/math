```javascript
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "فقط درخواست POST مجاز است."
    });
  }

  const apiKey = process.env.GAPGPT_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "کلید API در تنظیمات سرور پیدا نشد."
    });
  }

  try {
    const {
      message = "",
      grade = "7",
      history = [],
      image = null
    } = req.body || {};

    if (!message.trim() && !image) {
      return res.status(400).json({
        error: "لطفاً سؤال را بنویس یا عکس تمرین را ارسال کن."
      });
    }

    if (
      image &&
      (typeof image !== "string" ||
       !/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(image))
    ) {
      return res.status(400).json({
        error: "فرمت عکس معتبر نیست."
      });
    }

    if (image && image.length > 7000000) {
      return res.status(413).json({
        error: "حجم عکس زیاد است؛ لطفاً عکس کوچک‌تری بفرست."
      });
    }

    const grades = {
      "7": "هفتم",
      "8": "هشتم",
      "9": "نهم"
    };

    const gradeName = grades[String(grade)] || "هفتم تا نهم";

    const systemPrompt = `
تو «ریاضی‌یار»، دستیار تخصصی آموزش ریاضی پایه ${gradeName} هستی.

قوانین پاسخ‌گویی:
- به فارسی روان و دقیق پاسخ بده.
- مطالب را بیش از حد ساده نکن؛ توضیحات باید علمی و مناسب کتاب ریاضی همین پایه باشند.
- راه‌حل را مرحله‌به‌مرحله بنویس و دلیل هر مرحله را توضیح بده.
- فرمول‌ها، جایگذاری عددها و محاسبات را دقیق نشان بده.
- در هندسه، فرض‌ها، روابط، استدلال و نتیجه‌گیری را مشخص کن.
- در پایان، در صورت نیاز، روش بررسی جواب یا نکتهٔ مهم را بنویس.
- اگر عکس ارسال شده، صورت سؤال را با دقت بخوان.
- اگر بخشی از عکس ناخواناست، درباره‌اش حدس نزن.
- اگر امکان پردازش تصویر را نداری، صادقانه اعلام کن.
`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    if (Array.isArray(history)) {
      for (const item of history.slice(-10)) {
        if (
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        ) {
          messages.push({
            role: item.role,
            content: item.content.slice(0, 8000)
          });
       
