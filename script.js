let sustainability = 50;
    let selectedPlot = null;
    const farm = document.getElementById("farm");
    const toast = document.getElementById("toast");

    // Create 9 plots
    for (let i = 0; i < 9; i++) {
      let div = document.createElement("div");
      div.className = "plot";
      div.innerHTML = "🌾";
      div.onclick = () => selectPlot(i, div);
      farm.appendChild(div);
    }

    function selectPlot(i, div) {
      selectedPlot = i;
      document.getElementById("plotDetails").textContent =
        `Plot ${i+1}: NDVI ${(Math.random()*0.8+0.2).toFixed(2)}, Soil Moisture ${(Math.random()*40+20).toFixed(1)}%`;
    }

    function irrigate() {
      if (selectedPlot === null) return showToast("Select a plot first!");
      sustainability += 2;
      updateScore();
      showToast("💧 Irrigation applied!");
    }

    function fertilize() {
      if (selectedPlot === null) return showToast("Select a plot first!");
      sustainability += 3;
      updateScore();
      showToast("🌱 Fertilizer applied!");
    }

    function advanceDay() {
      sustainability -= Math.floor(Math.random() * 5);
      updateScore();
      showToast("⏭ A day has passed...");
      if (sustainability <= 0) endGame("Your farm collapsed! 🌍");
    }

    function updateScore() {
      document.getElementById("sustainability").textContent =
        `🌱 Sustainability Score: ${sustainability}`;
      if (sustainability >= 100) endGame("Congratulations! 🌟 Sustainable farming achieved!");
    }

    function showToast(msg) {
      toast.textContent = msg;
      toast.className = "show";
      setTimeout(() => toast.className = toast.className.replace("show", ""), 3000);
    }

    function startGame() {
      document.getElementById("tutorial").style.display = "none";
    }

    function endGame(message) {
      document.getElementById("endScreen").style.display = "flex";
      document.getElementById("endMessage").textContent = message;
    }

    function restartGame() {
      sustainability = 50;
      updateScore();
      document.getElementById("endScreen").style.display = "none";
    }

    // Chart.js NDVI chart
    const ctx = document.getElementById("ndviChart").getContext("2d");
    const ndviChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: ["Day 1", "Day 2", "Day 3"],
        datasets: [{
          label: "NDVI",
          data: [0.3, 0.5, 0.6],
          borderColor: "green",
          fill: false
        }]
      }
    });