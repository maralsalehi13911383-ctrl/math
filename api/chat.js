
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

    if (
      typeof message !== "string" ||
      (!message.trim() && !image)
    ) {
      return res.status(400).json({
        error: "لطفاً سؤال را بنویس یا عکس تمرین را ارسال کن."
      });
    }

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

    // محدودیت حجم برای جلوگیری از درخواست بیش از حد بزرگ
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

    const gradeName = grades[String(grade)] || "هفتم تا نهم";

    const systemPrompt = `
تو «ریاضی‌یار»، دستیار تخصصی آموزش ریاضی پایه ${gradeName} هستی.

قوانین پاسخ‌گویی:
- به فارسی روان، دقیق و علمی پاسخ بده.
- مطالب را متناسب با کتاب ریاضی همین پایه توضیح بده.
- راه‌حل را مرحله‌به‌مرحله بنویس و دلیل هر مرحله را توضیح بده.
- فرمول‌ها، جایگذاری عددها و محاسبات را دقیق نشان بده.
- در هندسه، فرض‌ها، روابط، استدلال و نتیجه‌گیری را مشخص کن.
- در پایان، در صورت نیاز، روش بررسی جواب یا نکته مهم را بنویس.
- اگر عکس ارسال شده، صورت سؤال را با دقت بخوان.
- اگر بخشی از عکس ناخواناست، درباره آن حدس نزن و از دانش‌آموز توضیح بخواه.
- اگر سؤال چند بخش دارد، به هر بخش به ترتیب پاسخ بده.
- اگر موضوع سؤال خارج از ریاضی است، محترمانه توضیح بده که تخصصت آموزش ریاضی است.
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
        }
      }
    }

    // ساخت پیام فعلی؛ در صورت وجود عکس، تصویر هم ارسال می‌شود
    const userContent = image
      ? [
          {
            type: "text",
            text: message.trim() ||
              "لطفاً سؤال ریاضی داخل این تصویر را بخوان و مرحله‌به‌مرحله حل کن."
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
          temperature: 0.3
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("GapGPT API error:", response.status, data);

      return res.status(502).json({
        error:
          "ارتباط با سرویس هوش مصنوعی ناموفق بود. تنظیمات مدل و اعتبار API را بررسی کن."
      });
    }

    const answer = data?.choices?.[0]?.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(502).json({
        error: "پاسخ معتبری از مدل دریافت نشد."
      });
    }

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
