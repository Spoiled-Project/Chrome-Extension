importScripts("./globalConstants.js")

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
const fetchList = ()=>{
    fetch(`${SERVER_URL}`)
        .then(status)
        .then(function(response) {
            return response.json();
        })
        .then((list)=>{
                chrome.storage.local.set({[`${SERIES_LIST}`]: list})
                    .catch((err)=>{console.log(err)})
            }
        )
        .catch((error) =>{
            console.log(error)
        })

}