function updateButtonState() {
    const nightsInput = document.getElementById('nightsInput');
    const submitBtn = document.getElementById('submitBtn');
    const respectFilters = document.getElementById('respectFilters');
    const nights = parseInt(nightsInput.value, 10);
    
    // If respecting Airbnb filters, nights input is not required
    if (respectFilters.checked) {
        submitBtn.disabled = false;
        nightsInput.style.opacity = '0.7';
    } else {
        nightsInput.style.opacity = '1';
        
        if (!isNaN(nights) && nights >= 1 && nights <= 7) {
            submitBtn.disabled = false;
        } else {
            submitBtn.disabled = true;
        }
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
        
        const flexibilityOption = result.savedFlexibility || 'ignore';
        if (flexibilityOption === 'respect') {
            respectFilters.checked = true;
        } else {
            ignoreFilters.checked = true;
        }
        
        updateButtonState();
    });
    
    nightsInput.addEventListener('input', updateButtonState);
    respectFilters.addEventListener('change', updateButtonState);
    ignoreFilters.addEventListener('change', updateButtonState);
    
    updateButtonState();
});

document.getElementById('submitBtn').addEventListener('click', () => {
    const nights = parseInt(document.getElementById('nightsInput').value, 10);
    const flexibilityOption = document.querySelector('input[name="flexibility"]:checked').value;
    
    let isValid = false;
    let nightsToSend = nights;
    
    if (flexibilityOption === 'respect') {
        isValid = true;
        nightsToSend = 1;
    } else {
        isValid = !isNaN(nights) && nights >= 1 && nights <= 7;
    }
    
    if (isValid) {
        chrome.storage.local.set({ 
            savedNights: nights || 1,
            savedFlexibility: flexibilityOption
        });
        
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { 
                type: "SET_NIGHTS", 
                nights: nightsToSend,
                flexibility: flexibilityOption
            });
        });
        
        window.close();
    } else {
        alert('Please enter a number between 1 and 7 nights.');
    }
});