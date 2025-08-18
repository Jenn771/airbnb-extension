// Update button state based on the input
function updateButtonState() {
    const nightsInput = document.getElementById('nightsInput');
    const submitBtn = document.getElementById('submitBtn');
    const nights = parseInt(nightsInput.value, 10);

    if (!isNaN(nights) && nights >= 1 && nights <= 7) {
        submitBtn.disabled = false;
    } else {
        submitBtn.disabled = true;
    }
}

// Load the previous saved values when popup opens
document.addEventListener('DOMContentLoaded', () => {
    const nightsInput = document.getElementById('nightsInput');
    const submitBtn = document.getElementById('submitBtn');
    const respectFilters = document.getElementById('respectFilters');
    const ignoreFilters = document.getElementById('ignoreFilters');
    
    // Load saved values
    chrome.storage.local.get(['savedNights', 'savedFlexibility'], (result) => {
        if (result.savedNights) {
            nightsInput.value = result.savedNights;
        }
        
        // Load saved flexibility option (default to 'respect')
        const flexibilityOption = result.savedFlexibility || 'respect';
        if (flexibilityOption === 'respect') {
            respectFilters.checked = true;
        } else {
            ignoreFilters.checked = true;
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
    
    // Get the selected flexibility option
    const flexibilityOption = document.querySelector('input[name="flexibility"]:checked').value;

    if (!isNaN(nights) && nights >= 1 && nights <= 7) {
        // Save the number of nights and flexibility option to use in the future
        chrome.storage.local.set({ 
            savedNights: nights,
            savedFlexibility: flexibilityOption
        });
        
        // Send number of nights and flexibility option to content.js
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { 
                type: "SET_NIGHTS", 
                nights: nights,
                flexibility: flexibilityOption
            });
        });
        
        window.close();
    } else {
        alert('Please enter a number between 1 and 7 nights.');
    }
});

