(function(){
    const USER_CHOICES = "userChoices";
    //const BLOCK_IMAGE_PATH = chrome.runtime.getURL('images/block.jpg');
    const BLOCK_IMAGE_PATH = chrome.runtime.getURL('images/blocked.svg');
    //const AZURE_URL = "https://spoiledservice.azurewebsites.net"
    const AZURE_URL = "http://127.0.0.1:8080"
    const PIC_TAGS = 'source, img'
    const POSSIBLE_SRC_ATTR_NAMES = ['src','srcset','data-src']
    const IS_USER_CHANGE_PIC = "data-is-user-change"
    const config = {attributes: true, childList: true, subtree: true, characterData: true}
    const INVALID_IMAGES_TYPES = ["svg","pdf","gif","webp","dng","tiff"]
    const VALID_WIDTH = 150
    const VALID_HEIGHT = 150
    let queue = []; // hold elements to be sent to server
    let queueTimer = null; // hold timer


    const getImageSize = (image) => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        return { width, height };
    };
    const isValidSize = (width,height)=>{
        //console.log(width, height)
        //console.log(VALID_WIDTH <=width)
        //console.log(VALID_HEIGHT <= height)
        //console.log(VALID_HEIGHT <= height && VALID_WIDTH <=width)
        return VALID_HEIGHT <= height || VALID_WIDTH <=width
    }
    const isInvalidType = (image) => {
        const src = image.src;
        const extension = src.substring(src.lastIndexOf('.') + 1).toLowerCase();
        return INVALID_IMAGES_TYPES.some((val)=> val===extension);
    };
    const processQueue = async () => {
        if(queue.length > 0) {
            await getServerResults(queue);
            queue = [];
        }
        queueTimer = null;
    };

    const enqueueImage = (image) => {
        queue.push(image);
        // If a timer isn't already running, start one.
        // When it expires, it'll process all elements currently in the queue.
        if(queueTimer === null) {
            queueTimer = setTimeout(processQueue, 100); // adjust time as needed
        }
    };

    /**
     * Change the images for the first time - check if there are elements with tags' names that could hold an image
     * and send it to server check.
     */
    const changeImages = ()=>{
        //console.log("Change images");
        let srcElements = document.querySelectorAll(PIC_TAGS);
        // srcElements.forEach((image) => {
        //     if (image.complete) {
        //         // If the image has already loaded, process it immediately.
        //         //getServerResults([image]);
        //         enqueueImage(image)
        //     } else {
        //         // Otherwise, wait for the load event.
        //         //image.addEventListener('load', () => getServerResults([image]));
        //         image.addEventListener('load', () => enqueueImage(image));
        //     }
        // });

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    let image = entry.target;
                    const {width,height} = getImageSize(image)
                    //console.log(image)
                    //console.log(!isInvalidType(image))
                    if (!isInvalidType(image) && isValidSize(width,height)){
                        enqueueImage(image);
                        //console.log("valid")
                    }
                    else{
                        //console.log("invalid")
                    }
                    observer.unobserve(image);
                }
            });
        });

        srcElements.forEach((image) => {
            observer.observe(image);
        });
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
                //console.log(err)
                return [];
            })
        }
        function status(response) {
            //console.log("status")
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
            //console.log("fetching")
            fetch(`${AZURE_URL}`, {method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(toServer)
            })
                .then(status)
                .then(function(response) {
                    //console.log("json")
                    return response.json();
                })
                .then((res)=>{
                    //console.log("result")
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
                    let currentNodes = nodeMap.get(key);
                    if(currentNodes) {
                        currentNodes.forEach((currentNode)=>{
                            POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName) => {
                                if ((currentNode.getAttribute(attributeName))) {
                                    let timeoutId;
                                    let src = currentNode.getAttribute(attributeName)
                                    if (src!==BLOCK_IMAGE_PATH){
                                        currentNode.setAttribute(attributeName, BLOCK_IMAGE_PATH)
                                        currentNode.setAttribute(IS_USER_CHANGE_PIC, false);
                                        setTimeout(()=>{
                                            currentNode.addEventListener("mouseenter",()=>{
                                                timeoutId = setTimeout(()=>{
                                                    currentNode.setAttribute(attributeName,src)
                                                    currentNode.setAttribute(IS_USER_CHANGE_PIC, true);
                                                },2000)
                                            })
                                            currentNode.addEventListener('mouseleave', () => {
                                                // Clear the timer if the mouse leaves the element before 2 seconds
                                                clearTimeout(timeoutId);
                                            });
                                        },1000)
                                    }


                                }
                            })
                        })

                        // POSSIBLE_SRC_ATTR_NAMES.every((attributeName) => {
                        //     let src;
                        //     if ((src = currentNode.getAttribute(attributeName))) {
                        //         currentNode.setAttribute(attributeName, BLOCK_IMAGE_PATH)
                        //     }
                        //     return !src;
                        // })
                    }
                }
            })
        }
        let toServer = {"series":await getUserChoices(),"images":[]};
        if (!toServer.series.length)
            return;
        let nodeMap = new Map();
        for (let elem of elements){
            //console.log(elem)
            let src;
            if (!elem.dataset.isUserChange){
                POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName)=>{
                    src = elem.getAttribute(attributeName)
                    if (src === BLOCK_IMAGE_PATH)
                        src = null;
                    if(src){
                        //console.log("CATCHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH")
                        let currentArr = nodeMap.get(src)
                        if (currentArr && !currentArr.includes(elem))
                            nodeMap.get(src).push(elem);
                        else
                            nodeMap.set(src, [elem]);
                        toServer.images.push(src);
                    }
                })
                src = null;
                if (elem.currentSrc && elem.currentSrc!== BLOCK_IMAGE_PATH)
                    src = elem.currentSrc
                if(src){
                    //console.log("CATCHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH")
                    let currentArr = nodeMap.get(src)
                    if (currentArr && !currentArr.includes(elem))
                        nodeMap.get(src).push(elem);
                    else
                        nodeMap.set(src, [elem]);
                    toServer.images.push(src);
                }
            }

            // if (!POSSIBLE_SRC_ATTR_NAMES.every((attributeName)=>{
            //     if (elem.currentSrc)
            //         src = elem.currentSrc
            //     else
            //         src = elem.getAttribute(attributeName)
            //     if (src === BLOCK_IMAGE_PATH)
            //         src = null;
            //     return !src;
            // }))
            // {
            //     console.log("CATCHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH")
            //     nodeMap.set(src, elem);
            //     toServer.images.push(src);
            // }
        }
        //console.log(toServer)
        if (!!toServer.images.length){
            //console.log("Gettt")
            getResult(toServer, nodeMap);
            // console.log(nodeMap)
            // nodeMap.forEach((val)=>{
            //     val.forEach((currentNode)=>{
            //         let attributes = {}
            //         POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName) => {
            //             if ((currentNode.getAttribute(attributeName))) {
            //                 let src = currentNode.getAttribute(attributeName)
            //                 if (src!==BLOCK_IMAGE_PATH)
            //                     attributes[attributeName]=src
            //             }
            //         })
            //         console.log(attributes)
            //         console.log(Object.keys(attributes).length)
            //         if (!!Object.keys(attributes).length) {
            //             console.log("doing changes with", attributes)
            //             let timeoutId;
            //             [...Object.keys(attributes)].forEach((attributeName) => {
            //                 currentNode.setAttribute(attributeName, BLOCK_IMAGE_PATH)
            //             })
            //             currentNode.setAttribute(IS_USER_CHANGE_PIC, false);
            //             [...Object.entries(attributes)].forEach(([attributeName, src]) => {
            //                 console.log(attributeName,src)
            //             })
            //             setTimeout(() => {
            //                 currentNode.addEventListener("mouseenter", () => {
            //                     timeoutId = setTimeout(() => {
            //                         let lastSrc;
            //                         [...Object.entries(attributes)].forEach(([attributeName, src]) => {
            //                             currentNode.setAttribute(attributeName, src)
            //                             lastSrc = src
            //                         })
            //                         POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName)=>{
            //                             let currentSrc = currentNode.getAttribute(attributeName)
            //                             if (currentSrc && currentSrc===BLOCK_IMAGE_PATH){
            //                                 currentNode.setAttribute(attributeName,currentSrc)
            //                             }
            //                         })
            //                         currentNode.setAttribute(IS_USER_CHANGE_PIC, true);
            //                     }, 2000)
            //                 })
            //                 currentNode.addEventListener('mouseleave', () => {
            //                     // Clear the timer if the mouse leaves the element before 2 seconds
            //                     clearTimeout(timeoutId);
            //                 });
            //             }, 1000)
            //         }
            //     })
            // })
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
    // const observe = new MutationObserver((mutations)=>{
    //     //const sendImages = [];
    //     mutations.forEach((mutation)=>{
    //         if (mutation.type === "attributes" &&
    //             POSSIBLE_SRC_ATTR_NAMES.some((elem)=>elem === mutation.attributeName)){
    //             const node = mutation.target;
    //             console.log(node);
    //             if (node.matches(PIC_TAGS) || node.tagName === 'IMG'){
    //                 getServerResults([node])
    //             }
    //         }
    //         mutation.addedNodes.forEach((node) => {
    //             if (node.nodeType === Node.ELEMENT_NODE){
    //                 console.log(node);
    //                 if (node.matches(PIC_TAGS) || node.tagName === 'IMG'){
    //                     getServerResults([node])
    //                 }
    //                 else{
    //                     const images = node.querySelectorAll(PIC_TAGS)
    //                     //const images = Array.from(node.querySelectorAll(PIC_TAGS))
    //                     console.log(images)
    //
    //                     if (images.length) {
    //                         console.log("Found")
    //                         //sendImages.push(...images)
    //                         getServerResults(images)
    //                     }
    //                 }
    //
    //             }
    //         })
    //     })
    //     // if(sendImages.length)
    //     //     getServerResults(sendImages);
    // })
    const observe = new MutationObserver((mutations)=>{
        //const sendImages = [];
        mutations.forEach((mutation)=>{
            if (mutation.type === "attributes" &&
                POSSIBLE_SRC_ATTR_NAMES.some((elem)=>elem === mutation.attributeName)){
                const node = mutation.target;
                //console.log(node);
                if (node.matches(PIC_TAGS) || node.tagName === 'IMG'){
                    node.onload = function(){
                        //getServerResults([node])
                        const {width,height} = getImageSize(node)
                        //console.log(node)
                        //console.log(!isInvalidType(node))
                        if (!isInvalidType(node) && isValidSize(width,height)){
                            enqueueImage(node);
                            //console.log("valid")
                        }
                        else{
                            //console.log("invalid")
                        }
                        enqueueImage(node)
                    }
                }
            }
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE){
                    //console.log(node);
                    if (node.matches(PIC_TAGS) || node.tagName === 'IMG'){
                        node.onload = function(){
                            //getServerResults([node])
                            const {width,height} = getImageSize(node)
                            //console.log(node)
                            //console.log(!isInvalidType(node))
                            if (!isInvalidType(node) && isValidSize(width,height)){
                                enqueueImage(node);
                                //console.log("valid")
                            }
                            else{
                                //console.log("invalid")
                            }
                        }
                    }
                    else{
                        const images = node.querySelectorAll(PIC_TAGS)
                        //const images = Array.from(node.querySelectorAll(PIC_TAGS))
                        //console.log(images)

                        if (images.length) {
                            //console.log("Found")
                            //sendImages.push(...images)
                            //getServerResults(images)
                            images.forEach(image=>{
                                image.onload = function (){
                                    const {width,height} = getImageSize(image)
                                    //console.log(image)
                                    //console.log(!isInvalidType(image))
                                    if (!isInvalidType(image) && isValidSize(width,height)){
                                        enqueueImage(image);
                                        //console.log("valid")
                                    }
                                    else{
                                        //console.log("invalid")
                                    }
                                }
                            })
                        }
                    }

                }
            })
        })
        // if(sendImages.length)
        //     getServerResults(sendImages);
    })

    // window.addEventListener('load',function(){
    //     changeImages();
    //     observe.observe(document.body,config);
    // })

    changeImages();
    observe.observe(document.body, config);

})();