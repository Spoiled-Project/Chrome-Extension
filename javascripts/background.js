importScripts("./fetchSeriesList.js");
//const SERIES_PATH = "series"
const ALARM_NAME = "fetchListAlarm"
const INSTALL_REASON = "install"

/**
 * Listener to messages (fetch series' list)
 */
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.message === 'callFetchSeries') {
        let res =  await fetchList()
        console.log(res)
        sendResponse({error:res})
    }
});

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
