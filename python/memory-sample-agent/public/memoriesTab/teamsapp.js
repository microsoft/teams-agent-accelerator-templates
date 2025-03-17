// Initialize the Teams SDK with fallback for browser testing
async function initializeTeamsOrBrowser() {
    return await microsoftTeams.app.initialize();
}

function displayError(error) {
  memoriesContainer.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-4 text-center text-gray-400">
                    No memories found
                </td>
            </tr>`;
}

// Initialize and load memories
initializeTeamsOrBrowser()
  .then(() => {
    return microsoftTeams.app.getContext();
  })
  .then((context) => {
    const userId = context.user?.id;
    if (!userId) {
      console.error("User ID not found in context");
      return;
    }
    loadMemories(userId);
  })
  .catch((error) => {
    console.error("Error getting context:", error);
    displayError("Error loading memories");
  });

/**
 * Loads and displays memories from the server
 */
async function loadMemories(userId) {
  const memoriesContainer = document.getElementById("memoriesContainer");
  try {
    const response = await fetch(`/api/memories?userId=${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const memories = await response.json();

    if (memories.length === 0) {
      displayError("No memories found");
    }

    console.log("Memories loaded:", memories);
    memoriesContainer.innerHTML = memories
      .map(
        (memory) => `
            <tr class="hover:bg-gray-700/50">
                <td class="px-6 py-4 whitespace-pre-wrap">${memory.content}</td>
                <td class="px-6 py-4 text-gray-400">${new Date(
                  memory.created_at
                ).toLocaleString()}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${
                      memory.type === "SEMANTIC"
                        ? "bg-blue-900 text-blue-200"
                        : "bg-green-900 text-green-200"
                    }">
                        ${memory.type || "SEMANTIC"}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1">
                        ${(memory.attributions || [])
                          .map(
                            (attr) => `
                            <span class="px-2 py-1 text-xs font-medium bg-gray-700 rounded-full">
                                ${attr}
                            </span>
                        `
                          )
                          .join("")}
                    </div>
                </td>
            </tr>
        `
      )
      .join("");
  } catch (error) {
    console.error("Error loading memories:", error);
    memoriesContainer.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-4 text-center text-red-400">
                    Error loading memories. Please try again later.
                </td>
            </tr>`;
  }
}
