// Wait for the user to click the "Submit" button
document.getElementById('submitBtn').addEventListener('click', () => {
    // Get the value from the input field with ID 'nightsInput'
    const nights = parseInt(document.getElementById('nightsInput').value, 10);

    if (!isNaN(nights) && nights > 0) {
        // Send number of nights to content.js
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "SET_NIGHTS", nights });
        });

        console.log(`Sent nights: ${nights}`);
    } else {
        alert('Please enter a valid number of nights.');
    }
});

