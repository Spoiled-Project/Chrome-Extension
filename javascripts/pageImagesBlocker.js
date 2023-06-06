
(function(){
    /**
     * Lock - a class that handle with race conditions when asynchronous functions runs together.
     */
    class Lock {
        /**
         * C-tor, holds the lock and a queue for the tasks that needs to do.
         */
        constructor() {
            this.isLocked = false;
            this.resolveQueue = [];
        }

        /**
         * This method is acquiring the lock. The function is until the lock will be free with waiting to Promise resolve.
         * @returns {Promise<void>}
         */
        async acquire(priority) {
            return new Promise(resolve => {
                if (!this.isLocked) {
                    this.isLocked = true;
                    resolve();
                } else {
                    if (!!priority && priority===1)
                        this.resolveQueue.unshift(resolve)
                    else
                        this.resolveQueue.push(resolve);
                }
            });
        }

        /**
         * This method handle with the releasing of the lock. It calls to the next task in the queue and
         */
        release() {
            if (this.resolveQueue.length > 0) {
                const nextResolve = this.resolveQueue.shift();
                nextResolve();
            } else {
                this.isLocked = false;
            }
        }
    }
    const MY_LOCK = new Lock();
    const USER_CHOICES = "userChoices";
    const BLOCK_IMAGE_PATH = chrome.runtime.getURL('images/blocked.svg');
    const CHECKED_SRC = new Map()
    //const AZURE_URL = ""
    const AZURE_URL = "http://127.0.0.1:8080"
    const PIC_TAGS = 'source, img'
    const POSSIBLE_SRC_ATTR_NAMES = ['src','srcset','data-src']
    const IS_USER_CHANGE_PIC = "data-is-user-change"
    const OBSERVER_CONFIG = {attributes: true, childList: true, subtree: true, characterData: true}
    const INVALID_IMAGES_TYPES = ["svg","pdf","gif","webp","dng","tiff"]
    const MAX_SIZE = 150
    let queue = new Set(); // hold elements to be sent to server
    let queueTimer = null; // hold timer

    /**
     * Return the size of an image
     * @param image - image element
     * @returns {{width: number, height: number}}
     */
    const getImageSize = (image) => {
        const width = Math.min(!!image.width ? image.width:MAX_SIZE, image.naturalWidth)
        const height = Math.min(!!image.height ? image.height: MAX_SIZE, image.naturalHeight)
        return { width , height};
    };

    /**
     * Return if an image is in valid size (weight or height >= MAX_SIZE)
     * @param width - a width in pixels.
     * @param height - a height in pixels
     * @returns {boolean} True if weight or height >= MAX_SIZE, otherwise false.
     */
    const isValidSize = (width,height)=>{
        return MAX_SIZE <= height || MAX_SIZE <=width
    }
    /**
     * Check if image src have a valid type.
     * @param src An image's source.
     * @returns {boolean} Return true if the type of the image is invalid.
     */
    const isInvalidType = (src) => {
        const extension = src.substring(src.lastIndexOf('.') + 1).toLowerCase();
        return INVALID_IMAGES_TYPES.some((val)=> val===extension);
    };

    /**
     * This function is executing when there is a timeout in queueTimer. It sends all the image elements' to
     * getServerResults function.
     * @returns {Promise<void>}
     */
    const processQueue = async () => {
        await MY_LOCK.acquire(1);
        if(queue.size > 0) {
            getServerResults(Array.from(queue));
            queue.clear();
        }
        queueTimer = null;
        MY_LOCK.release();
    };

    /**
     *
     * @param image
     * @returns {Promise<void>}
     */
    const enqueueImage = async (image) => {
        await MY_LOCK.acquire(0);
        queue.add(image);
        if(queueTimer === null) {
            queueTimer = setTimeout(processQueue, 100); // adjust time as needed
        }
        MY_LOCK.release();
    };


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
    const getAllNodeRelevantAttributes = (currentNode)=>{
        let attributes = {}
        POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName) => {
            if ((currentNode.getAttribute(attributeName))) {
                let src = currentNode.getAttribute(attributeName)
                if (src!==BLOCK_IMAGE_PATH)
                    attributes[attributeName]=src
            }
        })
        if (currentNode.currentSrc && currentNode.currentSrc!==BLOCK_IMAGE_PATH)
            attributes["currentSrc"] = currentNode.currentSrc
        return attributes
    }

    const changeAttributesToBlockImage = (attributes, currentNode)=>{
        [...Object.keys(attributes)].forEach((attributeName) => {
            if (attributeName === "currentSrc")
                currentNode.currentSrc = BLOCK_IMAGE_PATH
            else
                currentNode.setAttribute(attributeName, BLOCK_IMAGE_PATH)
        })
    }

    const addExposeListener = (attributes, currentNode)=>{
        let timeoutId;
        setTimeout(() => {
            currentNode.addEventListener("mouseenter", () => {
                timeoutId = setTimeout(() => {
                    [...Object.entries(attributes)].forEach(([attributeName, src]) => {
                        if (attributeName === "currentSrc")
                            currentNode.currentSrc = src
                        else
                            currentNode.setAttribute(attributeName, src)
                    })
                    currentNode.setAttribute(IS_USER_CHANGE_PIC, true);
                }, 2000)
            })
            currentNode.addEventListener('mouseleave', () => {
                // Clear the timer if the mouse leaves the element before 2 seconds
                clearTimeout(timeoutId);
            });
        }, 1000)
    }

    function handleResult(res,nodeMap){

        Object.entries(res).forEach(([src,isSpoiler])=>{
            let currentNodes = nodeMap.get(src);
            CHECKED_SRC.set(src,isSpoiler);
            if(!!currentNodes && !!currentNodes.size && isSpoiler) {
                Array.from(currentNodes).forEach((currentNode)=>{
                    let attributes = getAllNodeRelevantAttributes(currentNode)

                    if (!!Object.keys(attributes).length) {
                        currentNode.setAttribute(IS_USER_CHANGE_PIC, false);
                        changeAttributesToBlockImage(attributes,currentNode)
                        addExposeListener(attributes,currentNode)
                    }
                })
            }

        })
    }

    /**
     * This function gets server result for all the sources. (the implementation is temporary)
     * @param elements
     */
    const getServerResults = async (elements = []) =>{
        let toServer = {"series":await getUserChoices(),"images":[]};
        if (!toServer.series.length)
            return;
        let nodeMap = new Map();

        const addElementToDataStructures = (src,element)=>{
            if(!!src && src !== BLOCK_IMAGE_PATH && !isInvalidType(src)){
                let lastIsSpoiler = CHECKED_SRC.get(src)
                if ((lastIsSpoiler===null || lastIsSpoiler===undefined)) {
                    if (nodeMap.get(src))
                        nodeMap.get(src).add(element);
                    else
                        nodeMap.set(src, new Set([element]));
                    toServer.images.push(src);
                }
                //if the src checked but there are attributes that changed again, replace them to BLOCK
                else if (lastIsSpoiler === true){
                    let attributes = getAllNodeRelevantAttributes(element)
                    if (!!Object.keys(attributes).length) {
                        element.setAttribute(IS_USER_CHANGE_PIC, false);
                        [...Object.keys(attributes)].forEach((attributeName) => {
                            if (attributeName === "currentSrc")
                                CHECKED_SRC.set(element.currentSrc, true)
                            else
                                CHECKED_SRC.set(element.getAttribute(attributeName), true)
                        })
                        changeAttributesToBlockImage(attributes,element)
                        addExposeListener(attributes,element)
                    }
                }
            }
        }

        for (let elem of elements){
            const {width,height} = getImageSize(elem)
            if (isValidSize(width,height)) {
                POSSIBLE_SRC_ATTR_NAMES.forEach((attributeName) => {
                    addElementToDataStructures(elem.getAttribute(attributeName), elem)
                })
                addElementToDataStructures(elem.currentSrc, elem)
            }
        }

        if (!!toServer.images.length){
            /**If you want to test locally the program and block all images, close the getResult function and open the
             * part down to it */
            getResult(toServer, nodeMap);
            // nodeMap.forEach((set)=>{
            //     Array.from(set).forEach((currentNode)=>{
            //         let attributes = getAllNodeRelevantAttributes(currentNode)
            //         if (!!Object.keys(attributes).length) {
            //             currentNode.setAttribute(IS_USER_CHANGE_PIC, false);
            //             [...Object.keys(attributes)].forEach((attributeName) => {
            //                 if (attributeName === "currentSrc")
            //                     CHECKED_SRC.set(currentNode.currentSrc, true)
            //                 else
            //                     CHECKED_SRC.set(currentNode.getAttribute(attributeName), true)
            //             })
            //             changeAttributesToBlockImage(attributes,currentNode)
            //             addExposeListener(attributes,currentNode)
            //         }
            //     })
            // })
        }
    }
    const isNotAllAttributesSetToBlock = (imageNode)=>{
        return (imageNode.currentSrc && imageNode.currentSrc!== BLOCK_IMAGE_PATH) ||
            POSSIBLE_SRC_ATTR_NAMES.some((attributeName) => {
                let src = imageNode.getAttribute(attributeName)
                return !!src && src!==BLOCK_IMAGE_PATH
            })
    }
    const insertToQueue = (imageNode)=>{
        if (imageNode.dataset.isUserChange == null ||
            (imageNode.dataset.isUserChange ==="false" && isNotAllAttributesSetToBlock(imageNode))){
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
    observe.observe(document.documentElement, OBSERVER_CONFIG);

})();