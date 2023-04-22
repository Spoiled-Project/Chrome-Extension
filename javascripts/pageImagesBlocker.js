(function(){
    const USER_CHOICES = "userChoices";
    const BLOCK_IMAGE_PATH = chrome.runtime.getURL('images/block.jpg');
    const config = {attributes: true, childList: true, subtree: true, characterData: true}
    //const AZURE_URL = "https://spoiledservice.azurewebsites.net"
    const AZURE_URL = "http://127.0.0.1:5000"
    const PIC_TAGS = 'source, img, image'
    const POSSIBLE_SRC_ATTR_NAMES = ['src','srcset']
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
            Object.entries(res).forEach(([key,value])=>{
                if (value){
                    let currentNode = nodeMap.get(key);
                    POSSIBLE_SRC_ATTR_NAMES.every((attributeName)=>{
                        let src;
                        if ((src =currentNode.getAttribute(attributeName)))
                            (src!==BLOCK_IMAGE_PATH)? currentNode.setAttribute(attributeName,BLOCK_IMAGE_PATH): src=null
                        console.log(src);
                        return !src;
                    })
                }
            })
        }
        let toServer = {"series":await getUserChoices(),"images":[]};
        if (!toServer.series.length)
            return;
        let nodeMap = new Map();
        // temp implementation, will be changed to server's check.
        elements.forEach((elem)=>{
            let src;
            if (!POSSIBLE_SRC_ATTR_NAMES.every((attributeName)=>{
                    src = elem.getAttribute(attributeName)
                    return !src;
                }))
            {
                nodeMap.set(src, elem);
                toServer.images.push(src);
            }
        })
        console.log(toServer)
        if (!!toServer.images.length)
            getResult(toServer, nodeMap);

    }

    //create a mutation observer to handle page changes
    const observe = new MutationObserver((mutations)=>{
        console.log("mutation")
        mutations.forEach((mutation)=>{
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE){
                    const images = node.querySelectorAll(PIC_TAGS)
                    if (images.length)
                        getServerResults(images);
                }
            })
        })
    })
    changeImages();
    observe.observe(document,config);

})();