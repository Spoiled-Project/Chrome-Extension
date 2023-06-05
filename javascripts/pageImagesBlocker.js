
(function(){
    class Lock {
        constructor() {
            this.isLocked = false;
            this.queue = [];
        }

        async acquire() {
            const acquirePromise = new Promise((resolve) => {
                const task = () => {
                    if (!this.isLocked) {
                        this.isLocked = true;
                        resolve();
                    } else {
                        this.queue.push(task);
                    }
                };
                task();
            });

            await acquirePromise;
        }

        release() {
            if (this.queue.length > 0) {
                const nextTask = this.queue.shift();
                nextTask();
            } else {
                this.isLocked = false;
            }
        }
    }
    const myLock = new Lock();
    const USER_CHOICES = "userChoices";
    const BLOCK_IMAGE_PATH = chrome.runtime.getURL('images/blocked.svg');
    //const AZURE_URL = ""
    const AZURE_URL = "http://127.0.0.1:8080"
    const PIC_TAGS = 'source, img'
    const POSSIBLE_SRC_ATTR_NAMES = ['src','srcset','data-src']
    const IS_USER_CHANGE_PIC = "data-is-user-change"
    const config = {attributes: true, childList: true, subtree: true, characterData: true}
    const INVALID_IMAGES_TYPES = ["svg","pdf","gif","webp","dng","tiff"]
    const VALID_WIDTH = 150
    const VALID_HEIGHT = 150
    let queue = new Set(); // hold elements to be sent to server
    let queueTimer = null; // hold timer


    const getImageSize = (image) => {
        const width = Math.min(!!image.width ? image.width:VALID_WIDTH, image.naturalWidth)
        const height = Math.min(!!image.height ? image.height: VALID_HEIGHT, image.naturalHeight)
        return { width , height};
    };
    const isValidSize = (width,height)=>{
        return VALID_HEIGHT <= height || VALID_WIDTH <=width
    }
    const isInvalidType = (image) => {
        const src = image.src;
        const extension = src.substring(src.lastIndexOf('.') + 1).toLowerCase();
        return INVALID_IMAGES_TYPES.some((val)=> val===extension);
    };
    const processQueue = async () => {
        await myLock.acquire();
        if(queue.size > 0) {
            getServerResults(Array.from(queue));
            queue.clear();
        }
        queueTimer = null;
        myLock.release();
    };

    const enqueueImage = async (image) => {
        await myLock.acquire();
        queue.add(image);
        if(queueTimer === null) {
            queueTimer = setTimeout(processQueue, 100); // adjust time as needed
        }
        myLock.release();
    };

    /**
     * Change the images for the first time - check if there are elements with tags' names that could hold an image
     * and send it to server check.
     */
    const changeImages = ()=>{
        //console.log("Change images");
        let srcElements = document.querySelectorAll(PIC_TAGS);

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    insertToQueue(entry.target)
                }
            });
        });

        srcElements.forEach((image) => {
            observer.observe(image);
        });
    }
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
            let currentNodes = nodeMap.get(key);
            if (value){
                if(!!currentNodes && !!currentNodes.size) {
                    Array.from(currentNodes).forEach((currentNode)=>{
                        let attributes = {}
                        POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName) => {
                            if ((currentNode.getAttribute(attributeName))) {
                                let src = currentNode.getAttribute(attributeName)
                                if (src!==BLOCK_IMAGE_PATH)
                                    attributes[attributeName]=src
                            }
                        })
                        console.log(attributes, currentNode)
                        //console.log(attributes)
                        //console.log(Object.keys(attributes).length)
                        if (!!Object.keys(attributes).length) {
                            //console.log("doing changes with", attributes)
                            [...Object.keys(attributes)].forEach((attributeName) => {
                                currentNode.setAttribute(attributeName, BLOCK_IMAGE_PATH)
                            })
                            let timeoutId;
                            currentNode.setAttribute(IS_USER_CHANGE_PIC, false);
                            setTimeout(() => {
                                currentNode.addEventListener("mouseenter", () => {
                                    timeoutId = setTimeout(() => {
                                        let lastSrc;
                                        [...Object.entries(attributes)].forEach(([attributeName, src]) => {
                                            currentNode.setAttribute(attributeName, src)
                                            lastSrc = src
                                        })
                                        // POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName)=>{
                                        //     let currentSrc = currentNode.getAttribute(attributeName)
                                        //     if (currentSrc && currentSrc===BLOCK_IMAGE_PATH){
                                        //         currentNode.setAttribute(attributeName,currentSrc)
                                        //     }
                                        // })
                                        currentNode.setAttribute(IS_USER_CHANGE_PIC, true);
                                    }, 2000)
                                })
                                currentNode.addEventListener('mouseleave', () => {
                                    // Clear the timer if the mouse leaves the element before 2 seconds
                                    clearTimeout(timeoutId);
                                });
                            }, 1000)
                        }
                        // POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName) => {
                        //     if ((currentNode.getAttribute(attributeName))) {
                        //         let timeoutId;
                        //         let src = currentNode.getAttribute(attributeName)
                        //         if (src!==BLOCK_IMAGE_PATH){
                        //             currentNode.setAttribute(attributeName, BLOCK_IMAGE_PATH)
                        //             currentNode.setAttribute(IS_USER_CHANGE_PIC, false);
                        //             setTimeout(()=>{
                        //                 currentNode.addEventListener("mouseenter",()=>{
                        //                     timeoutId = setTimeout(()=>{
                        //                         currentNode.setAttribute(attributeName,src)
                        //                         currentNode.setAttribute(IS_USER_CHANGE_PIC, true);
                        //                     },2000)
                        //                 })
                        //                 currentNode.addEventListener('mouseleave', () => {
                        //                     // Clear the timer if the mouse leaves the element before 2 seconds
                        //                     clearTimeout(timeoutId);
                        //                 });
                        //             },1000)
                        //         }
                        //     }
                        // })
                    })
                }
            }
        })
    }

    /**
     * This function gets server result for all the sources. (the implementation is temporary)
     * @param elements
     */
    const getServerResults = async (elements = []) =>{
        //console.log(elements)
        let toServer = {"series":await getUserChoices(),"images":[]};
        if (!toServer.series.length)
            return;
        let nodeMap = new Map();
        const addElementToDataStructures = (src,element)=>{
            console.log(src)
            if(!!src && src !== BLOCK_IMAGE_PATH){
                if (nodeMap.get(src))
                    nodeMap.get(src).add(element);
                else
                    nodeMap.set(src, new Set([element]));
                toServer.images.push(src);
            }
        }

        for (let elem of elements){
            console.log(elem)
            console.log(!elem.dataset.isUserChange)
            if (!elem.dataset.isUserChange){
                POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName)=>{
                    addElementToDataStructures(elem.getAttribute(attributeName),elem)
                })
                addElementToDataStructures(elem.currentSrc,elem)
            }

        }
        //console.log(toServer)
        if (!!toServer.images.length){
            //console.log("Gettt")
            //getResult(toServer, nodeMap);
            //console.log(nodeMap)
            nodeMap.forEach((set)=>{
                Array.from(set).forEach((currentNode)=>{
                    let attributes = {}
                    POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName) => {
                        if ((currentNode.getAttribute(attributeName))) {
                            let src = currentNode.getAttribute(attributeName)
                            if (src!==BLOCK_IMAGE_PATH)
                                attributes[attributeName]=src
                        }
                    })
                    if (!!Object.keys(attributes).length) {
                        let timeoutId;
                        [...Object.keys(attributes)].forEach((attributeName) => {
                            currentNode.setAttribute(attributeName, BLOCK_IMAGE_PATH)
                        })
                        currentNode.setAttribute(IS_USER_CHANGE_PIC, false);
                        setTimeout(() => {
                            currentNode.addEventListener("mouseenter", () => {
                                timeoutId = setTimeout(() => {
                                    let lastSrc;
                                    [...Object.entries(attributes)].forEach(([attributeName, src]) => {
                                        currentNode.setAttribute(attributeName, src)
                                        lastSrc = src
                                    })
                                    currentNode.setAttribute(IS_USER_CHANGE_PIC, true);
                                }, 2000)
                            })
                            currentNode.addEventListener('mouseleave', () => {
                                clearTimeout(timeoutId);
                            });
                        }, 1000)
                    }
                })
            })
        }
    }
    const insertToQueue = (imageNode)=>{
        const isNotAllAttributesSetToBlock =
            POSSIBLE_SRC_ATTR_NAMES.some((attributeName) => {
                let src = imageNode.getAttribute(attributeName)
                return !!src && src!==BLOCK_IMAGE_PATH
            })
        const handledAttribute = imageNode.getAttribute(IS_USER_CHANGE_PIC)
        const {width,height} = getImageSize(imageNode)
        //console.log(imageNode)
        //console.log(!isInvalidType(imageNode), isValidSize(width,height), (handledAttribute===null || handledAttribute=== undefined || isNotAllAttributesSetToBlock))
        if (!isInvalidType(imageNode) && isValidSize(width,height) &&
            (handledAttribute===null || handledAttribute=== undefined || isNotAllAttributesSetToBlock)){
            enqueueImage(imageNode);
        }
    }
    const addImageLoadEventIfNotHandled = (imageNode, processedElements)=>{
        if (!processedElements.has(imageNode) ) {
            processedElements.add(imageNode)
            imageNode.onload = function(){
                insertToQueue(imageNode)
            }
        }
    }
    //create a mutation observer to handle page changes
    const observe = new MutationObserver((mutations)=>{
        if (!document.body)
            return;

        const processedElements = new Set();
        mutations.forEach((mutation)=>{
            if (mutation.type === "attributes" &&
                POSSIBLE_SRC_ATTR_NAMES.some((elem)=>elem === mutation.attributeName)){
                const node = mutation.target;
                if (node.matches(PIC_TAGS) || node.tagName === 'IMG'){
                    addImageLoadEventIfNotHandled(node,processedElements)
                }
            }
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE){
                    if (node.matches(PIC_TAGS) || node.tagName === 'IMG'){
                        addImageLoadEventIfNotHandled(node,processedElements)
                    }
                    else{
                        const images = node.querySelectorAll(PIC_TAGS)
                        if (images.length) {
                            images.forEach(image=>{
                                addImageLoadEventIfNotHandled(image,processedElements)

                            })
                        }
                    }

                }
            })
        })
    })

    //changeImages();
    observe.observe(document.documentElement, config);

})();