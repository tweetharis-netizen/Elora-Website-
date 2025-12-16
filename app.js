document.getElementById("sendBtn").addEventListener("click", async () => {
  const input = document.getElementById("userInput").value;
  const responseBox = document.getElementById("response");

  responseBox.textContent = "Elora is thinking...";

  try {
    const response = await fetch("https://elora-website-9pagv9vcm-haris-projects-20c5a383.vercel.app/elora", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt: input })
    });

    const data = await response.json();
    responseBox.textContent = data.reply;
  } catch (err) {
    responseBox.textContent = "Error: " + err.message;
  }
});
