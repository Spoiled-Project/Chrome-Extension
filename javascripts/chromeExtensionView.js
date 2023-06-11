
(function(){
    const USER_CHOICES = "userChoices"
    const SERIES_LIST = "seriesList"
    const FETCH_SERIES_MSG = "callFetchSeries"
    /**
     * This module holds all elements' ids
     * @type {{SERIES_LIST_PAGE_ELEMENT: HTMLElement, HOME_PAGE_ID: string, CHOOSE_SERIES_BUTTON_ID: string, SERIES_LIST_PAGE_ID: string, FORM_SUBMISSION_SERIES_ID: string, FORM_SUBMISSION_SERIES_ELEMENT: HTMLElement, HOME_PAGE_ELEMENT: HTMLElement}}
     */
    const elementAndIdsModule = (function(){
        const HOME_PAGE_ID = "homePage"
        const CHOOSE_SERIES_BUTTON_ID = "chooseSeriesBtn"
        const SERIES_LIST_PAGE_ID = "seriesListPage"
        const FORM_SUBMISSION_SERIES_ID = "seriesListForm"
        const BACK_TO_MAIN_PAGE = "backButton"
        const ERROR_ID = "errorDisplay"
        const ERROR_ELEMENT = document.getElementById(ERROR_ID)
        const BACK_BUTTON_ELEMENT = document.getElementById(BACK_TO_MAIN_PAGE)
        const HOME_PAGE_ELEMENT = document.getElementById(HOME_PAGE_ID)
        const SERIES_LIST_PAGE_ELEMENT = document.getElementById(SERIES_LIST_PAGE_ID)
        const FORM_SUBMISSION_SERIES_ELEMENT = document.getElementById(FORM_SUBMISSION_SERIES_ID)

        return{
            HOME_PAGE_ELEMENT, CHOOSE_SERIES_BUTTON_ID, SERIES_LIST_PAGE_ELEMENT, SERIES_LIST_PAGE_ID,
            FORM_SUBMISSION_SERIES_ELEMENT, FORM_SUBMISSION_SERIES_ID, HOME_PAGE_ID,BACK_BUTTON_ELEMENT,
            ERROR_ELEMENT
        }
    })();


    /**
     * A listener to chrome extension buttons.
     */
    document.addEventListener("DOMContentLoaded", (event)=>{
        chrome.runtime.sendMessage({ message: FETCH_SERIES_MSG}, (res)=>{
            console.log(res)
            if (!!res)
                console.log(res.error)
            elementAndIdsModule.ERROR_ELEMENT.innerHTML = (!!res&& !!res.error)? res.error:"";
        });
        document.getElementById(elementAndIdsModule.CHOOSE_SERIES_BUTTON_ID).addEventListener("click",showSeries)
        elementAndIdsModule.FORM_SUBMISSION_SERIES_ELEMENT.addEventListener("submit",handleUserChoices)
        elementAndIdsModule.BACK_BUTTON_ELEMENT.addEventListener("click",(event)=>{backToHomePage(elementAndIdsModule.SERIES_LIST_PAGE_ELEMENT)})

    })

    /**
     * The function shows the series that the user could choose
     *
     */
    async function showSeries(){
        elementAndIdsModule.HOME_PAGE_ELEMENT.classList.add("d-none")
        elementAndIdsModule.SERIES_LIST_PAGE_ELEMENT.classList.remove("d-none")
        await displaySeries()
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
        console.log(series);
        let seriesList = document.getElementById(SERIES_LIST)
        seriesList.innerHTML = ""
        let userChoicesString = await getUserChoices()
        console.log(userChoicesString)
        userChoicesString = userChoicesString.join(" ")

        //will be changed to id from server.
        series.forEach((seriesName)=>{
            seriesList.innerHTML+=`
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="${seriesName.replaceAll(" ","_")}" name="${seriesName}" 
                    ${userChoicesString.includes(seriesName) ? `checked` : ""}>
                    <label class="form-check-label capitalize" for="${seriesName.replaceAll(" ","_")}">${seriesName}</label>
                </div>
            `
        })
    }
    /**
     * This function is return user to the home page by removing the .
     * @param elementToRemove
     */
    const backToHomePage = (elementToRemove)=>{
        elementAndIdsModule.HOME_PAGE_ELEMENT.classList.remove("d-none")
        elementToRemove.classList.add("d-none")
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
        backToHomePage(elementAndIdsModule.SERIES_LIST_PAGE_ELEMENT)

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

