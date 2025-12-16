document.getElementById('sendBtn').addEventListener('click', async () => {
  const input = document.getElementById('userInput').value;
  const responseBox = document.getElementById('response');

  responseBox.textContent = "Elora is thinking...";

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-sonnet',
        messages: [
          {
            role: 'system',
            content: 'You are Elora, an AI designed to help with educational tasks like lesson planning, quiz generation, and slide creation for teachers, students, and parents.'
          },
          {
            role: 'user',
            content: input
          }
        ]
      })
    });

    const data = await response.json();
    responseBox.textContent = data.choices?.[0]?.message?.content || 'Sorry, Elora could not generate a response.';
  } catch (error) {
    responseBox.textContent = 'An error occurred: ' + error.message;
  }
});