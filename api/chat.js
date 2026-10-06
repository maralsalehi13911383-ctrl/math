
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
    const { message, grade, history = [] } = req.body || {};

    if (!message) {
      return res.status(400).json({
        error: "لطفاً سؤال ریاضی را وارد کن."
      });
    }

    const response = await fetch(
      "https://api.gapgpt.app/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                `تو ریاضی‌یار، دستیار آموزش ریاضی پایه ${grade === "auto" ? "هفتم تا دوازدهم" : grade} هستی. به فارسی ساده جواب بده، مسائل را مرحله‌به‌مرحله حل کن و فرمول‌ها را با نمادگذاری LaTeX بنویس.`
            },
            ...history.slice(-10),
            { role: "user", content: message }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("GapGPT error:", data);
      return res.status(502).json({
        error: "سرویس هوش مصنوعی پاسخ نداد. تنظیمات API را بررسی کن."
      });
    }

    const answer = data.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(502).json({
        error: "پاسخ معتبری از سرویس دریافت نشد."
      });
    }

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("Chat API error:", error);
    return res.status(500).json({
      error: "خطا در ارتباط با سرویس هوش مصنوعی."
    });
  }
}
