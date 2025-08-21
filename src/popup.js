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

document.addEventListener('DOMContentLoaded', () => {
    const nightsInput = document.getElementById('nightsInput');
    const submitBtn = document.getElementById('submitBtn');
    const respectFilters = document.getElementById('respectFilters');
    const ignoreFilters = document.getElementById('ignoreFilters');
    
    chrome.storage.local.get(['savedNights', 'savedFlexibility'], (result) => {
        if (result.savedNights) {
            nightsInput.value = result.savedNights;
        }
        
        // Default to 'respect' if no saved preference
        const flexibilityOption = result.savedFlexibility || 'respect';
        if (flexibilityOption === 'respect') {
            respectFilters.checked = true;
        } else {
            ignoreFilters.checked = true;
        }
        
        // Update the button state after loading the saved value
        updateButtonState();
    });
    
    nightsInput.addEventListener('input', updateButtonState);
    
    // Initial button state
    updateButtonState();
});

document.getElementById('submitBtn').addEventListener('click', () => {
    const nights = parseInt(document.getElementById('nightsInput').value, 10);
    const flexibilityOption = document.querySelector('input[name="flexibility"]:checked').value;

    if (!isNaN(nights) && nights >= 1 && nights <= 7) {
        chrome.storage.local.set({ 
            savedNights: nights,
            savedFlexibility: flexibilityOption
        });
        
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