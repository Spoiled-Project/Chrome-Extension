// const AZURE_URL = "https://spoiledservice.azurewebsites.net"
// const SERIES_PATH = "series"

(function(){
    const USER_CHOICES = "userChoices"
    const SERIES_LIST = "seriesList"
    /**
     * This module holds all elements' ids
     * @type {{SERIES_LIST_PAGE_ELEMENT: HTMLElement, HOME_PAGE_ID: string, CHOOSE_SERIES_BUTTON_ID: string, SERIES_LIST_PAGE_ID: string, FORM_SUBMISSION_SERIES_ID: string, FORM_SUBMISSION_SERIES_ELEMENT: HTMLElement, HOME_PAGE_ELEMENT: HTMLElement}}
     */
    const elementAndIdsModule = (function(){
        const HOME_PAGE_ID = "homePage"
        const CHOOSE_SERIES_BUTTON_ID = "chooseSeriesBtn"
        const SERIES_LIST_PAGE_ID = "seriesListPage"
        const FORM_SUBMISSION_SERIES_ID = "seriesListForm"
        const HOME_PAGE_ELEMENT = document.getElementById(HOME_PAGE_ID)
        const SERIES_LIST_PAGE_ELEMENT = document.getElementById(SERIES_LIST_PAGE_ID)
        const FORM_SUBMISSION_SERIES_ELEMENT = document.getElementById(FORM_SUBMISSION_SERIES_ID)

        return{
            HOME_PAGE_ELEMENT, CHOOSE_SERIES_BUTTON_ID, SERIES_LIST_PAGE_ELEMENT, SERIES_LIST_PAGE_ID,
            FORM_SUBMISSION_SERIES_ELEMENT, FORM_SUBMISSION_SERIES_ID, HOME_PAGE_ID
        }
    })();


    /**
     * A listener to chrome extension buttons.
     */
    document.addEventListener("DOMContentLoaded",(event)=>{
        //addSupportedSeries()
        document.getElementById(elementAndIdsModule.CHOOSE_SERIES_BUTTON_ID).addEventListener("click",showSeries)
        elementAndIdsModule.FORM_SUBMISSION_SERIES_ELEMENT.addEventListener("submit",handleUserChoices)
        displaySeries()
    })

    /**
     * The function shows the series that the user could choose
     * @param _ - none
     */
    function showSeries(_){
        elementAndIdsModule.HOME_PAGE_ELEMENT.classList.add("d-none")
        elementAndIdsModule.SERIES_LIST_PAGE_ELEMENT.classList.remove("d-none")
    }

    /**
     * The function gets the series list from chrome.storage.local
     * @returns {Promise<unknown>}
     */
    const getSeriesList = async ()=>{
        return new Promise((res)=>{
            chrome.storage.local.get([SERIES_LIST], (obj)=>{
                res(obj[SERIES_LIST] ? obj[SERIES_LIST]: [])
            });
        })
    }

    /**
     * The function displays the series list on the relevant page.
     * It also marks the series that the user has chosen.
     * @returns {Promise<void>}
     */
    const displaySeries = async () =>{
        let series = await getSeriesList()
        let seriesList = document.getElementById(SERIES_LIST)
        let userChoicesString = await getUserChoices()
        userChoicesString = userChoicesString.join(" ")

        //will be changed to id from server.
        let id = 1
        series.forEach((seriesName)=>{
            seriesList.innerHTML+=`
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="${id}_${seriesName}" name="${id}_${seriesName}" 
                    ${userChoicesString.includes(seriesName) ? `checked` : ""}>
                    <label class="form-check-label" for="series_1">${seriesName}</label>
                </div>
            `
            id++
        })
    }
    /**
     * The function gets user choices when the user is clicking on submit and saves them inside
     * chrome.storage.local in a key named ["userChoices"]
     * @param event
     * @returns {Promise<void>}
     */
    const handleUserChoices = async(event)=>{
        event.preventDefault()
        let formData = new FormData(elementAndIdsModule.FORM_SUBMISSION_SERIES_ELEMENT);
        let userChoices = []
        for (const name of formData.keys()){
            userChoices.push(name)
        }
        await chrome.storage.local.set({[USER_CHOICES]:JSON.stringify(userChoices)})
        elementAndIdsModule.HOME_PAGE_ELEMENT.classList.remove("d-none")
        elementAndIdsModule.SERIES_LIST_PAGE_ELEMENT.classList.add("d-none")
    }

    /**
     *  This function returns the user's series choices from the chrome.storage.local.
     * @returns {Promise<unknown>}
     */
    const getUserChoices = async () =>{
        return new Promise((res)=>{
            chrome.storage.local.get([USER_CHOICES], (obj)=>{
                res(obj[USER_CHOICES] ? JSON.parse(obj[USER_CHOICES]): [])
            });
        })
    }
})();

