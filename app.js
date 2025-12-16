
async function generate() {
    const prompt = document.getElementById('prompt').value;
    const output = document.getElementById('output');
    output.textContent = "Generating...";

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": "Bearer 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",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "mistralai/mistral-7b-instruct:free",
                messages: [{ role: "user", content: prompt }]
            })
        });

        const data = await response.json();
        output.textContent = data.choices?.[0]?.message?.content || "Sorry, no response.";
    } catch (error) {
        output.textContent = "Error: " + error.message;
    }
}
