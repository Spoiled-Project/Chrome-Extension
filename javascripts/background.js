//const AZURE_URL = "https://spoiledservice.azurewebsites.net"
const AZURE_URL = "http://127.0.0.1:5000"
//const SERIES_PATH = "series"
const ALARM_NAME = "fetchListAlarm"
const INSTALL_REASON = "install"
const SERIES_LIST = "seriesList"

/**
 * Checks if the chrome extension currently installs
 * If it is, fetch the series list.
 */
chrome.runtime.onInstalled.addListener(details => {
    if (details.reason === INSTALL_REASON)
        fetchList()
})

/**
 * Sets an alarm that is fetching the series list every day.
 */
chrome.alarms.create(ALARM_NAME,{
    when: Date.now() + 1000,
    periodInMinutes: 60*24
})

/**
 * Listen to the alarm event.
 */
chrome.alarms.onAlarm.addListener((alarm)=>{
    if (alarm.name === ALARM_NAME)
        fetchList()
})

/**
 * The function checks if the status code is ok and returns a promise matching the result.
 * @param response
 * @returns {Promise<never>|Promise<unknown>}
 */
function status(response) {
    if (response.status >= 200 && response.status < 300) {
        return Promise.resolve(response)
    } else {
        return Promise.reject(new Error(response.statusText))
    }
}

/**
 * The function fetches the series list inside the server and saves it in
 * chrome.storage.local with a key named 'seriesList'.
 */
function fetchList(){
    console.log("Fetching")
    // fetch(`${AZURE_URL}/${SERIES_PATH}`)
    fetch(`${AZURE_URL}`)
        .then(status)
        .then(function(response) {
            return response.json();
        })
        .then((list)=>{
            console.log(list)
                chrome.storage.local.set({[`${SERIES_LIST}`]: list})
                    .catch((err)=>{console.log(err)})
            }
        )
        .catch((error) =>{
            console.log(error)
        })

}
// async function getCurrentTab() {
//     let queryOptions = { active: true, lastFocusedWindow: true };
//     let [tab] = await chrome.tabs.query(queryOptions);
//     return tab;
// }
// chrome.tabs.onUpdated.addListener((tabId,changeInfo, tab)=>{
//     console.log("update")
//     if (changeInfo.status === 'complete'){
//         console.log("complete")
//         chrome.scripting.executeScript({
//             target: { tabId: tabId},
//             files: ['pageImagesBlocker.js']
//         })
//         .then(()=>{console.log("success")})
//         .catch((err)=>{
//             console.log(err)
//         })
//     }
// })
// chrome.scripting.executeScript({
//             target: { tabId: await getCurrentTab().id},
//             files: ['pageImagesBlocker.js'],
//         }).catch((err)=>{
//         console.log(err)
// });


// chrome.webRequest.onBeforeRequest.addListener((details)=>{
//
//         if(details.type ==="image"){
//             return {redirectURL: chrome.runtime.getURL("../images/block.jpg")}
//         }
//
//     },
//     {
//         urls: ["<all_urls>"],
//         types: ["image"]
//     },
//     ["blocking"]
// )
