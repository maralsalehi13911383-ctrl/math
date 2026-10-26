
export default async function handler(req, res) {
  // فقط درخواست POST مجاز است
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

    // بررسی ورودی
    if (
      typeof message !== "string" ||
      (!message.trim() && !image)
    ) {
      return res.status(400).json({
        error: "لطفاً سؤال را بنویس یا عکس تمرین را ارسال کن."
      });
    }

    // بررسی فرمت تصویر
    if (
      image &&
      (
        typeof image !== "string" ||
        !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)
      )
    ) {
      return res.status(400).json({
        error: "فرمت عکس معتبر نیست."
      });
    }

    // محدودیت حجم تصویر
    if (image && image.length > 4000000) {
      return res.status(413).json({
        error: "حجم عکس زیاد است؛ لطفاً عکس کوچک‌تری بفرست."
      });
    }

    const grades = {
      "7": "هفتم",
      "8": "هشتم",
      "9": "نهم"
    };

    const gradeName =
      grades[String(grade)] || "هفتم تا نهم";

    // دستورهای اصلی ریاضی‌یار
    const systemPrompt = `
تو «ریاضی‌یار»، یک معلم دقیق و حرفه‌ای ریاضی برای دانش‌آموزان پایه ${gradeName} هستی.

هدف تو این است که دانش‌آموز مسئله را واقعاً بفهمد، نه اینکه فقط جواب نهایی را ببیند.

قوانین مهم پاسخ‌گویی:

۱. به زبان فارسی روان، دقیق و قابل‌فهم پاسخ بده.

۲. تمام مراحل حل را کامل بنویس. هیچ عدد، عبارت ریاضی، فرمول یا نتیجه‌ای را از مراحل حذف نکن.

۳. هر مرحله باید شامل این سه مورد باشد:
- کاری که انجام می‌دهیم.
- دلیل انجام آن.
- محاسبات و نتیجه کامل همان مرحله.

۴. هرگز جای فرمول را خالی نگذار و عبارت‌هایی مثل «این معادله ساده می‌شود» را بدون نمایش معادله جدید ننویس.

۵. در معادلات، ابتدا صورت سؤال را بنویس، سپس عملیات را روی دو طرف معادله انجام بده و در پایان جواب را بررسی کن.

۶. اگر سؤال چند بخش دارد، تمام بخش‌ها را به‌ترتیب پاسخ بده.

۷. در هندسه، داده‌ها، خواسته، روابط، استدلال و نتیجه‌گیری را مشخص کن.

۸. در مسائل عددی، محاسبات را خودت بررسی کن. اگر جواب به دست آمده با جایگذاری در صورت سؤال سازگار نیست، محاسبه را دوباره بررسی کن.

۹. فرمول‌ها را با قالب استاندارد LaTeX بنویس:
فرمول داخل جمله: \\( ... \\)
فرمول جداگانه: \\[ ... \\]

۱۰. برای مثال، حل معادله 3x + 5 = 20 باید به این شکل باشد:

معادله:
\\[
3x+5=20
\\]

از هر دو طرف ۵ کم می‌کنیم:
\\[
3x+5-5=20-5
\\]
پس:
\\[
3x=15
\\]

طرفین را بر ۳ تقسیم می‌کنیم:
\\[
\\frac{3x}{3}=\\frac{15}{3}
\\]
بنابراین:
\\[
x=5
\\]

بررسی:
\\[
3(5)+5=15+5=20
\\]

پس جواب نهایی \\(x=5\\) است.

این مثال فقط الگوی نمایش مراحل است؛ هر مسئله را متناسب با صورت سؤال حل کن.

۱۱. اگر عکس ارسال شده است، متن، اعداد، علامت‌ها و خواسته سؤال را با دقت بخوان. اگر قسمتی ناخواناست، حدس نزن و از دانش‌آموز بخواه تصویر واضح‌تری بفرستد.

۱۲. سطح توضیحات باید مناسب پایه انتخاب‌شده باشد. از روش‌هایی استفاده کن که دانش‌آموز بتواند آن‌ها را بفهمد.

۱۳. اگر اطلاعات سؤال کافی نیست، اطلاعاتی را از خودت نساز.

۱۴. پاسخ را با نتیجه نهایی مشخص به پایان برسان.

۱۵. اگر سؤال خارج از حوزه ریاضی است، محترمانه توضیح بده که تخصص تو آموزش ریاضی است.

۱۶. قبل از ارسال پاسخ، بررسی کن که هیچ مرحله‌ای ناقص نباشد، همه فرمول‌ها نوشته شده باشند و جواب نهایی با محاسبات سازگار باشد.
`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // افزودن تاریخچه کوتاه گفتگو
    if (Array.isArray(history)) {
      for (const item of history.slice(-8)) {
        if (
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        ) {
          messages.push({
            role: item.role,
            content: item.content.slice(0, 4000)
          });
        }
      }
    }

    // ساخت پیام کاربر و افزودن تصویر در صورت وجود
    const userContent = image
      ? [
          {
            type: "text",
            text:
              message.trim() ||
              "سؤال ریاضی داخل تصویر را بخوان و با تمام مراحل حل کن."
          },
          {
            type: "image_url",
            image_url: {
              url: image
            }
          }
        ]
      : message.trim();

    messages.push({
      role: "user",
      content: userContent
    });

    // درخواست به سرویس GapGPT
    const response = await fetch(
      "https://api.gapgpt.app/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          temperature: 0.1,
          max_tokens: 3000
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "GapGPT API error:",
        response.status,
        data
      );

      return res.status(502).json({
        error:
          "ارتباط با سرویس هوش مصنوعی ناموفق بود. تنظیمات مدل و اعتبار API را بررسی کن."
      });
    }

    const answer =
      data?.choices?.[0]?.message?.content;

    if (
      typeof answer !== "string" ||
      !answer.trim()
    ) {
      console.error(
        "GapGPT returned an empty or invalid answer."
      );

      return res.status(502).json({
        error: "پاسخ معتبری از مدل دریافت نشد."
      });
    }

    // عیب‌یابی: بررسی اینکه پاسخ خام مدل خالی است یا نه
    // برای حفظ حریم خصوصی، متن کامل پاسخ کاربر در لاگ ثبت نمی‌شود.
    console.log("Mathyar answer received:", {
      answerLength: answer.length,
      containsLatex: /\\\[|\\\(|\$\$/.test(answer),
      model: data?.model || "unknown"
    });

    return res.status(200).json({
      answer: answer.trim()
    });

  } catch (error) {
    console.error("Chat API error:", error);

    return res.status(500).json({
      error: "هنگام پردازش درخواست خطایی رخ داد."
    });
  }
}
