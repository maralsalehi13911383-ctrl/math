
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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

    if (typeof message !== "string" ||
        (!message.trim() && !image)) {
      return res.status(400).json({
        error: "لطفاً سؤال را بنویس یا عکس تمرین را ارسال کن."
      });
    }

    if (image && (
      typeof image !== "string" ||
      !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)
    )) {
      return res.status(400).json({
        error: "فرمت عکس معتبر نیست."
      });
    }

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

    const gradeName = grades[String(grade)] || "هفتم";

    const systemPrompt = `
تو «ریاضی‌یار»، دبیر دقیق و متخصص ریاضی پایه ${gradeName} هستی.

هدف تو آموزش صحیح ریاضی است، نه صرفاً تولید یک جواب ظاهراً قانع‌کننده.

قوانین حل مسئله:
1. ابتدا صورت سؤال را دقیق بخوان و مشخص کن چه چیزی خواسته شده است.
2. داده‌ها، مجهول‌ها و شرط‌های مسئله را تشخیص بده.
3. مسئله را مرحله‌به‌مرحله حل کن و دلیل هر مرحله را توضیح بده.
4. محاسبات را واقعاً انجام بده؛ عدد، علامت، کسر یا عبارت ریاضی را حذف نکن.
5. پیش از ارائه پاسخ، محاسبات و جواب نهایی را دوباره بررسی کن.
6. اگر اطلاعات سؤال کافی نیست، حدس نزن؛ دقیقاً بگو چه اطلاعاتی لازم است.
7. اگر سؤال چند قسمت دارد، همه قسمت‌ها را به ترتیب پاسخ بده.
8. در هندسه، فرض‌ها، قضیه مورد استفاده، استدلال و نتیجه‌گیری را مشخص کن.
9. سطح توضیح متناسب با دانش‌آموز پایه ${gradeName} باشد؛ از توضیح‌های سطحی و مبهم پرهیز کن.
10. اگر از جواب مطمئن نیستی، عدم اطمینان را شفاف بیان کن.

قوانین مهم قالب‌بندی:
- پاسخ را به فارسی و با پاراگراف‌های منظم بنویس.
- برای فرمول‌های داخل متن از قالب LaTeX مانند \\(3x+5=20\\) استفاده کن.
- برای فرمول‌های مستقل، از \\[3x+5=20\\] استفاده کن.
- همه اعداد، عبارت‌ها و مراحل ریاضی لازم را صریح بنویس.
- از جای خالی، عبارت ناقص یا جمله‌هایی مانند «معادله ساده می‌شود» بدون نمایش معادله جدید خودداری کن.
- از گذاشتن فرمول در قالب کد استفاده نکن.
- جواب نهایی را با عنوان «پاسخ نهایی» مشخص کن.
- در پایان، در صورت مناسب بودن، جواب را با جایگذاری یا روش دیگری بررسی کن.

قوانین سؤال تصویری:
- اگر تصویر موجود است، ابتدا محتوای قابل خواندن آن را تشخیص بده.
- اگر تصویر شامل چند سؤال است، شماره سؤال موردنظر را مشخص کن یا به همه موارد خوانا پاسخ بده.
- اگر بخشی ناخواناست، همان بخش را مشخص کن و از دانش‌آموز عکس واضح‌تر یا متن آن را بخواه.
- هیچ عدد، علامت، توان، کسر یا شرطی را که در تصویر خوانده نمی‌توانی، از روی حدس تکمیل نکن.

اگر سؤال خارج از حوزه ریاضی است، مؤدبانه توضیح بده که تخصصت آموزش ریاضی است.
`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    // فقط پیام‌های معتبر تاریخچه را نگه می‌داریم.
    if (Array.isArray(history)) {
      for (const item of history.slice(-8)) {
        if (
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string" &&
          item.content.trim()
        ) {
          messages.push({
            role: item.role,
            content: item.content.slice(0, 4000)
          });
        }
      }
    }

    const userContent = image
      ? [
          {
            type: "text",
            text: message.trim() ||
              "سؤال ریاضی موجود در تصویر را بخوان و حل کن. اگر بخشی ناخواناست، حدس نزن."
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
          temperature: 0.1,
          max_tokens: 3000
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("GapGPT API error:", response.status, data);

      return res.status(502).json({
        error:
          "سرویس هوش مصنوعی نتوانست پاسخ دهد. تنظیمات مدل، اعتبار API و پشتیبانی از تصویر را بررسی کن."
      });
    }

    const answer = data?.choices?.[0]?.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      console.error("Invalid model response:", data);

      return res.status(502).json({
        error: "پاسخ معتبر یا کاملی از مدل دریافت نشد. دوباره تلاش کن."
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
