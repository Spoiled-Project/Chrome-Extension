(function(){
    const USER_CHOICES = "userChoices";
    const BLOCK_IMAGE_PATH = chrome.runtime.getURL('images/block.jpg');

    //const AZURE_URL = "https://spoiledservice.azurewebsites.net"
    const AZURE_URL = "http://127.0.0.1:5000"
    const PIC_TAGS = 'source, img'
    const POSSIBLE_SRC_ATTR_NAMES = ['src','srcset','data-src']
    const config = {attributes: true, childList: true, subtree: true, characterData: true}
    /**
     * Change the images for the first time - check if there are elements with tags' names that could hold an image
     * and send it to server check.
     */
    const changeImages = ()=>{
        console.log("Change images");
        let srcElements = document.querySelectorAll(PIC_TAGS);
        getServerResults (srcElements)
    }
    /**
     * This function gets server result for all the sources. (the implementation is temporary)
     * @param elements
     */
    const getServerResults = async (elements = []) =>{
        const getUserChoices = async () =>{
            return new Promise((res)=>{
                chrome.storage.local.get([USER_CHOICES], (obj)=>{
                    res(obj[USER_CHOICES] ? JSON.parse(obj[USER_CHOICES]): [])
                });
            }). catch((err)=>{
                console.log(err)
                return [];
            })
        }
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
        function getResult(toServer, nodeMap){
            // fetch(`${AZURE_URL}/${SERIES_PATH}`)
            fetch(`${AZURE_URL}`, {method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(toServer)
            })
                .then(status)
                .then(function(response) {
                    return response.json();
                })
                .then((res)=>{
                        handleResult(res,nodeMap);
                    }
                )
                .catch((error) =>{
                    console.log(error)
                })

        }

        function handleResult(res,nodeMap){
            console.log(res)
            Object.entries(res).forEach(([key,value])=>{
                if (value){
                    let currentNode = nodeMap.get(key);
                    if(currentNode) {
                        POSSIBLE_SRC_ATTR_NAMES.every((attributeName) => {
                            let src;
                            if ((src = currentNode.getAttribute(attributeName)))
                                currentNode.setAttribute(attributeName, BLOCK_IMAGE_PATH)
                            return !src;
                        })
                    }
                }
            })
        }
        let toServer = {"series":await getUserChoices(),"images":[]};
        if (!toServer.series.length)
            return;
        let nodeMap = new Map();
        for (let elem of elements){
            console.log(elem)
            let src;
            if (!POSSIBLE_SRC_ATTR_NAMES.every((attributeName)=>{
                if (elem.currentSrc)
                    src = elem.currentSrc
                else
                    src = elem.getAttribute(attributeName)
                if (src === BLOCK_IMAGE_PATH)
                    src = null;
                return !src;
            }))
            {
                console.log("CATCHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH")
                nodeMap.set(src, elem);
                toServer.images.push(src);
            }
        }
        console.log(toServer)
        if (!!toServer.images.length){
            console.log("Get")
            getResult(toServer, nodeMap);
            // [...nodeMap.values()].forEach((currentNode)=>{
            //     POSSIBLE_SRC_ATTR_NAMES.every((attributeName)=>{
            //         let src=null;
            //         if ((src =currentNode.getAttribute(attributeName)))
            //             currentNode.setAttribute(attributeName,BLOCK_IMAGE_PATH)
            //         return !src;
            //     })
            // })

        }


    }

    //create a mutation observer to handle page changes
    const observe = new MutationObserver((mutations)=>{
        //const sendImages = [];
        mutations.forEach((mutation)=>{
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE){
                        console.log(node);
                        console.log("Inside")
                        const images = node.querySelectorAll(PIC_TAGS)
                        //const images = Array.from(node.querySelectorAll(PIC_TAGS))

                        if (images.length) {
                            console.log("Found")
                            //sendImages.push(...images)
                            getServerResults(images)
                        }
                    }
                })
        })
        // if(sendImages.length)
        //     getServerResults(sendImages);
    })
    changeImages();
    observe.observe(document,config);
    document.addEventListener("DOMContentLoaded",()=>{
        console.log("LOADEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD")
    })
})();