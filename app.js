// Elora Web Logic - app.js

document.getElementById("lessonForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const grade = document.getElementById("grade").value;
  const subject = document.getElementById("subject").value;
  const topic = document.getElementById("topic").value;
  const output = document.getElementById("output");

  if (!topic) {
    output.textContent = "Please enter a topic.";
    return;
  }

  output.textContent = "Elora is thinking...";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer "
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `Create a structured, student-friendly lesson plan for a ${grade} ${subject} class on the topic of: ${topic}`
          }
        ]
      })
    });

    const data = await response.json();

    if (data.choices && data.choices[0]?.message?.content) {
      output.textContent = data.choices[0].message.content;
    } else {
      output.textContent = "Elora couldn't generate a full response. Try again.";
    }
  } catch (error) {
    output.textContent = "Error contacting Elora. Please check your internet or API key.";
    console.error("Fetch failed:", error);
  }
});

// Placeholder actions
['download', 'exportSlides', 'quiz'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    alert(`${id} feature coming soon!`);
  });
});