// Update button state based on the input
function updateButtonState() {
    const nightsInput = document.getElementById('nightsInput');
    const submitBtn = document.getElementById('submitBtn');
    const nights = parseInt(nightsInput.value, 10);

    if (!isNaN(nights) && nights > 0) {
        submitBtn.disabled = false;
    } else {
        submitBtn.disabled = true;
    }
}

// Load the previous saved number of nights when popup opens
document.addEventListener('DOMContentLoaded', () => {
    const nightsInput = document.getElementById('nightsInput');
    const submitBtn = document.getElementById('submitBtn');

    // Load saved value
    chrome.storage.local.get(['savedNights'], (result) => {
        if (result.savedNights) {
            nightsInput.value = result.savedNights;
        }

        // Update the button state after loading the saved value
        updateButtonState();
    });

    // Listen for input changes to update the button state
    nightsInput.addEventListener('input', updateButtonState);
    
    // Initial button state
    updateButtonState();
});

// Wait for the user to click the "Submit" button
document.getElementById('submitBtn').addEventListener('click', () => {
    // Get the value from the input field with ID 'nightsInput'
    const nights = parseInt(document.getElementById('nightsInput').value, 10);

    if (!isNaN(nights) && nights > 0) {
        // Save the number of nights to use in the future
        chrome.storage.local.set({ savedNights: nights });

        // Send number of nights to content.js
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "SET_NIGHTS", nights });
        });

        console.log(`Sent nights: ${nights}`);
        //window.close();
    } else {
        alert('Please enter a valid number of nights.');
    }
});

