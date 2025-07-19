chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "OPEN_LISTING_TAB") {
        (async () => {
            try {
                const tab = await new Promise((resolve, reject) => {
                    chrome.tabs.create({
                        url: message.link,
                        active: false
                    }, tab => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(tab);
                        }
                    });
                });

                console.log(`Tab ${tab.id} opened for ${message.link}`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                await chrome.tabs.remove(tab.id);

                sendResponse({ success: true, tabId: tab.id });
            } catch (error) {
                console.error("Failed to open tab:", error);
                sendResponse({ success: false, error: error.message });
            }
        })();

        // allows sendResponse to be called asynchronously
        return true;
    }
});
