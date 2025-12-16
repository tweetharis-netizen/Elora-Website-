document.getElementById("generate").addEventListener("click", async () => {
  const input = document.getElementById("input").value;
  const output = document.getElementById("output");
  output.textContent = "Thinking...";

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });

    const data = await response.json();
    output.textContent = data.response || "No response.";
  } catch (err) {
    output.textContent = "Error contacting Elora.";
  }
});